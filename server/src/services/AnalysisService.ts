import { Server } from 'socket.io';
import db from '../db/index.js';
import native from '../utils/native-loader.js';
import { ResourceGovernor } from '../utils/ResourceGovernor.js';

const CURRENT_ANALYSIS_VERSION = 1;

export class AnalysisService {
  private io: Server | null = null;
  private isAnalyzing = false;
  private isPaused = false;
  private queue: { id: string; file_path: string }[] = [];
  private governor = new ResourceGovernor();

  constructor(io: Server | null = null) {
    this.io = io;
  }

  setIo(io: Server): void {
    this.io = io;
  }

  async startBackgroundAnalysis() {
    if (this.isAnalyzing) return;

    // Priority 1: Recently played tracks that aren't analyzed
    const recentlyPlayed = db
      .prepare(
        `
      SELECT t.id, t.file_path FROM tracks t
      JOIN play_events p ON t.id = p.track_id
      WHERE (t.analysis_version IS NULL OR t.analysis_version < ?)
      AND t.missing = 0 AND t.file_type = 'audio'
      ORDER BY p.started_at DESC LIMIT 50
    `,
      )
      .all(CURRENT_ANALYSIS_VERSION) as { id: string; file_path: string }[];

    // Priority 2: Rest of the library (reduced batch to keep RAM usage low)
    const remaining = db
      .prepare(
        `
      SELECT id, file_path FROM tracks
      WHERE (analysis_version IS NULL OR analysis_version < ?)
      AND missing = 0 AND file_type = 'audio'
      LIMIT 50
    `,
      )
      .all(CURRENT_ANALYSIS_VERSION) as { id: string; file_path: string }[];

    // Priority 3: Tracks that need fingerprints for deduplication
    const needFingerprint = db
      .prepare(
        `
      SELECT id, file_path FROM tracks
      WHERE fingerprint IS NULL
      AND missing = 0 AND file_type = 'audio'
      LIMIT 50
    `,
      )
      .all() as { id: string; file_path: string }[];

    const combined = [...recentlyPlayed, ...remaining, ...needFingerprint];
    const seen = new Set<string>();
    this.queue = combined.filter((track) => {
      if (seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    });

    if (this.queue.length > 0) {
      this.isAnalyzing = true;
      this.processQueue();
    }
  }

  pause() { this.isPaused = true; }
  resume() { this.isPaused = false; this.startBackgroundAnalysis(); }
  getStatus() { return { isAnalyzing: this.isAnalyzing, isPaused: this.isPaused, queued: this.queue.length }; }

  private async processQueue() {
    const total = this.queue.length;
    let processed = 0;

    this.io?.emit('ANALYSIS_START', { total });

    while (this.queue.length > 0) {
      if (this.isPaused) {
          this.isAnalyzing = false;
          return;
      }

      if (this.governor.shouldPauseAnalysis()) {
          this.io?.emit('ANALYSIS_PAUSED', { reason: 'low_memory' });
          await new Promise(r => setTimeout(r, 5000));
          continue;
      }

      const track = this.queue.shift()!;
      try {
        // Run audio analysis
        const analysis = native.analyzeAudio(track.file_path);

        db.prepare(
          `
          UPDATE tracks SET
            bpm = ?,
            key = ?,
            camelot_key = ?,
            energy = ?,
            loudness = ?,
            analysis_version = ?,
            updated_at = ?
          WHERE id = ?
        `,
        ).run(
          analysis.bpm,
          analysis.key,
          analysis.camelotKey,
          analysis.energy,
          analysis.loudness,
          CURRENT_ANALYSIS_VERSION,
          Date.now(),
          track.id,
        );

        // Generate fingerprint in background for deduplication
        // This is CPU-intensive but we're in background already
        try {
          const fingerprint = native.generateWaveformFingerprint(track.file_path);
          if (fingerprint) {
            db.prepare('UPDATE tracks SET fingerprint = ? WHERE id = ?').run(
              fingerprint,
              track.id,
            );
          }
        } catch (e) {
          // Fingerprinting failed - not critical, continue
          console.error(`Fingerprint failed for ${track.file_path}:`, e);
        }

        processed++;
        this.io?.emit('ANALYSIS_PROGRESS', {
          processed,
          total,
          currentTrack: track.id,
        });
      } catch (e) {
        console.error(`Analysis failed for ${track.file_path}`, e);
      }

      // Yield back based on resource governor
      await new Promise<void>((resolve) => setTimeout(resolve, this.governor.delayBetweenTracks()));
    }

    this.isAnalyzing = false;
    this.io?.emit('ANALYSIS_COMPLETE', { processed, total });
  }

  async analyzeSingleTrack(trackId: string) {
    const track = db.prepare('SELECT id, file_path FROM tracks WHERE id = ?').get(trackId) as
      | { id: string; file_path: string }
      | undefined;
    if (!track) return;

    try {
      const analysis = native.analyzeAudio(track.file_path);
      db.prepare(
        `
        UPDATE tracks SET
          bpm = ?,
          key = ?,
          camelot_key = ?,
          energy = ?,
          loudness = ?,
          analysis_version = ?,
          updated_at = ?
        WHERE id = ?
      `,
      ).run(
        analysis.bpm,
        analysis.key,
        analysis.camelotKey,
        analysis.energy,
        analysis.loudness,
        CURRENT_ANALYSIS_VERSION,
        Date.now(),
        track.id,
      );
      return analysis;
    } catch (e) {
      console.error(`Manual analysis failed for ${track.file_path}`, e);
      throw e;
    }
  }
}

export const analysisService = new AnalysisService();
