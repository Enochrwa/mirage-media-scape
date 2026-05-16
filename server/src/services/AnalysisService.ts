import { Server } from 'socket.io';
import db from '../db/index.js';
import native from '../utils/native-loader.js';

const CURRENT_ANALYSIS_VERSION = 1;

export class AnalysisService {
  private io: Server | null = null;
  private isAnalyzing = false;
  private queue: { id: string; file_path: string }[] = [];

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

    // Priority 2: Rest of the library
    const remaining = db
      .prepare(
        `
      SELECT id, file_path FROM tracks
      WHERE (analysis_version IS NULL OR analysis_version < ?)
      AND missing = 0 AND file_type = 'audio'
      LIMIT 500
    `,
      )
      .all(CURRENT_ANALYSIS_VERSION) as { id: string; file_path: string }[];

    this.queue = [...new Set([...recentlyPlayed, ...remaining])];

    if (this.queue.length > 0) {
      this.isAnalyzing = true;
      this.processQueue();
    }
  }

  private async processQueue() {
    const total = this.queue.length;
    let processed = 0;

    this.io?.emit('ANALYSIS_START', { total });

    while (this.queue.length > 0) {
      const track = this.queue.shift()!;
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

        processed++;
        this.io?.emit('ANALYSIS_PROGRESS', {
          processed,
          total,
          currentTrack: track.id,
        });
      } catch (e) {
        console.error(`Analysis failed for ${track.file_path}`, e);
      }

      // Yield
      await new Promise((resolve) => setTimeout(resolve, 50));
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
