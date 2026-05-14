import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import native from '../utils/native-loader.js';
import type { TrackMetadata, AudioAnalysis } from '../../zovyra-native.js';

const { dbPath, folders, coversDir } = workerData;
const db = new Database(dbPath);

if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

async function scan() {
  let scanned = 0;
  let newTracks: Array<Record<string, unknown>> = [];

  const allFiles = native.scanFolders(folders);
  const total = allFiles.length;
  parentPort?.postMessage({ type: 'SCAN_START', total });

  for (const file of allFiles) {
    const filePath = file.path;
    try {
      const mtime = Math.floor(file.mtime);
      const fileSize = file.size;

      const existing = db
        .prepare('SELECT last_modified, id, file_size FROM tracks WHERE file_path = ?')
        .get(filePath) as { last_modified: number; id: string; file_size: number } | undefined;

      if (existing && existing.last_modified === mtime && existing.file_size === fileSize) {
        scanned++;
        if (scanned % 10 === 0) {
          parentPort?.postMessage({ type: 'SCAN_PROGRESS', scanned, total });
        }
        continue;
      }

      const metadata: TrackMetadata = native.extractMetadata(filePath);
      const id = existing?.id || crypto.createHash('md5').update(filePath).digest('hex');
      const fileType = metadata.hasVideo ? 'video' : 'audio';

      let coverCachePath: string | null = null;
      if (metadata.coverArtBytes) {
        coverCachePath = path.join(coversDir, `${id}.jpg`);
        fs.writeFileSync(coverCachePath, Buffer.from(metadata.coverArtBytes));
      }

      let thumbnailPath: string | null = null;
      if (fileType === 'video') {
        thumbnailPath = path.join(coversDir, `${id}_thumb.jpg`);
        try {
          native.generateThumbnail(filePath, metadata.duration * 0.25, thumbnailPath);
        } catch (_e) {
          thumbnailPath = null;
        }
      }

      db.prepare(
        `INSERT OR REPLACE INTO tracks (
          id, file_path, file_type, title, artist, album, album_artist,
          year, genre, track_number, disc_number, duration,
          sample_rate, bitrate, channels, cover_cache_path, thumbnail_path,
          last_modified, file_size, added_at, missing
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      ).run(
        id,
        filePath,
        fileType,
        metadata.title,
        metadata.artist,
        metadata.album,
        metadata.albumArtist,
        metadata.year,
        metadata.genre,
        metadata.trackNumber,
        metadata.discNumber,
        metadata.duration,
        metadata.sampleRate,
        metadata.bitRate,
        metadata.channels,
        coverCachePath,
        thumbnailPath,
        mtime,
        fileSize,
        Date.now(),
      );

      const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id);
      newTracks.push(track as Record<string, unknown>);
      scanned++;

      if (newTracks.length >= 20) {
        parentPort?.postMessage({ type: 'NEW_TRACKS', tracks: newTracks });
        newTracks = [];
      }

      if (scanned % 10 === 0) {
        parentPort?.postMessage({ type: 'SCAN_PROGRESS', scanned, total });
      }
    } catch (_error) {
      console.error(`Failed to process ${filePath}:`, _error);
    }
  }

  // Mark missing files
  const dbTracks = db.prepare('SELECT id, file_path FROM tracks WHERE missing = 0').all() as {
    id: string;
    file_path: string;
  }[];
  for (const track of dbTracks) {
    if (!fs.existsSync(track.file_path)) {
      db.prepare('UPDATE tracks SET missing = 1 WHERE id = ?').run(track.id);
    }
  }

  if (newTracks.length > 0) {
    parentPort?.postMessage({ type: 'NEW_TRACKS', tracks: newTracks });
  }

  parentPort?.postMessage({ type: 'SCAN_COMPLETE', scanned, total });

  // Background analysis
  setImmediate(async () => {
    const unanalyzed = db
      .prepare(
        'SELECT id, file_path FROM tracks WHERE bpm IS NULL AND file_type = "audio" AND missing = 0',
      )
      .all() as { id: string; file_path: string }[];
    for (const track of unanalyzed) {
      try {
        const analysis: AudioAnalysis = native.analyzeAudio(track.file_path);
        db.prepare(
          `UPDATE tracks SET
            bpm = ?, key = ?, camelot_key = ?, energy = ?, loudness = ?
          WHERE id = ?`,
        ).run(
          analysis.bpm,
          analysis.key,
          analysis.camelotKey,
          analysis.energy,
          analysis.loudness,
          track.id,
        );
        // Add small delay to avoid CPU spike
        await new Promise((r) => setTimeout(r, 50));
      } catch (_e) {
        console.error(`Analysis failed for ${track.file_path}`, _e);
      }
    }
  });
}

scan();