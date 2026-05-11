import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { createRequire } from 'node:module';
import { TrackMetadata, AudioMetadata } from '../../zovyra-native';
import { Track } from '../types/database';

const requireNative = createRequire(__filename);
const native = requireNative('../../zovyra-native.node') as typeof import('../../zovyra-native');

const { dbPath, folders, coversDir } = workerData;
const db = new Database(dbPath);

if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

function isMediaFile(filename: string): boolean {
  const extensions = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.mp4', '.mkv', '.avi'];
  return extensions.includes(path.extname(filename).toLowerCase());
}

async function scan() {
  let scanned = 0;
  let newTracks: Track[] = [];

  const allFiles: string[] = [];
  for (const folder of folders) {
    walk(folder, allFiles);
  }

  const total = allFiles.length;
  parentPort?.postMessage({ type: 'SCAN_START', total });

  for (const filePath of allFiles) {
    try {
      const stats = fs.statSync(filePath);
      const mtime = stats.mtimeMs;
      const fileSize = stats.size;

      const existing = db
        .prepare('SELECT mtime, id FROM tracks WHERE file_path = ?')
        .get(filePath) as { mtime: number; id: string } | undefined;

      if (existing && existing.mtime === mtime) {
        scanned++;
        if (scanned % 10 === 0) {
          parentPort?.postMessage({ type: 'SCAN_PROGRESS', scanned, total });
        }
        continue;
      }

      const metadata: TrackMetadata = native.extractMetadata(filePath);

      // Perform deep analysis for audio files
      let analysis: AudioMetadata | null = null;
      if (!filePath.endsWith('.mp4') && !filePath.endsWith('.mkv')) {
        try {
          analysis = native.analyzeAudio(filePath);
        } catch (e) {
          console.warn(`Audio analysis failed for ${filePath}:`, e);
        }
      }

      const id = existing?.id || crypto.createHash('md5').update(filePath).digest('hex');

      let coverCachePath: string | undefined = undefined;
      if (metadata.coverArt) {
        coverCachePath = path.join(coversDir, `${id}.jpg`);
        fs.writeFileSync(coverCachePath, Buffer.from(metadata.coverArt));
      }

      const trackData: Track = {
        id,
        title: metadata.title || path.basename(filePath),
        artist: metadata.artist || 'Unknown Artist',
        album: metadata.album || 'Unknown Album',
        genre: metadata.genre || 'Unknown Genre',
        year: metadata.year || undefined,
        duration: metadata.duration,
        bitrate: metadata.bitrate,
        sample_rate: metadata.sampleRate || undefined,
        channels: metadata.channels || undefined,
        file_path: filePath,
        file_size: fileSize,
        mtime: mtime,
        added_at: Date.now(),
        loudness: analysis?.loudness || undefined,
        bpm: analysis?.bpm || undefined,
        key: analysis?.key || undefined,
        camelot_key: analysis?.camelotKey || undefined,
        bpm_confidence: analysis?.bpmConfidence || undefined,
        cover_cache_path: coverCachePath,
        thumbnail_path: undefined,
        missing: 0,
        metadata_json: JSON.stringify({ ...metadata, analysis }),
      };

      db.prepare(
        `
                INSERT OR REPLACE INTO tracks (
                    id, title, artist, album, genre, year, duration,
                    bitrate, sample_rate, channels, file_path, file_size,
                    mtime, added_at, loudness, bpm, key, camelot_key,
                    bpm_confidence, cover_cache_path, thumbnail_path, missing, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
      ).run(
        trackData.id,
        trackData.title,
        trackData.artist,
        trackData.album,
        trackData.genre,
        trackData.year,
        trackData.duration,
        trackData.bitrate,
        trackData.sample_rate,
        trackData.channels,
        trackData.file_path,
        trackData.file_size,
        trackData.mtime,
        trackData.added_at,
        trackData.loudness,
        trackData.bpm,
        trackData.key,
        trackData.camelot_key,
        trackData.bpm_confidence,
        trackData.cover_cache_path,
        trackData.thumbnail_path,
        trackData.missing,
        trackData.metadata_json,
      );

      newTracks.push(trackData);
      scanned++;

      if (newTracks.length >= 20) {
        parentPort?.postMessage({ type: 'NEW_TRACKS', tracks: newTracks });
        newTracks = [];
      }

      if (scanned % 10 === 0) {
        parentPort?.postMessage({ type: 'SCAN_PROGRESS', scanned, total });
      }
    } catch (error) {
      console.error(`Failed to process ${filePath}:`, error);
    }
  }

  if (newTracks.length > 0) {
    parentPort?.postMessage({ type: 'NEW_TRACKS', tracks: newTracks });
  }

  parentPort?.postMessage({ type: 'SCAN_COMPLETE', scanned, total });
}

function walk(dir: string, files: string[]) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, files);
      } else if (isMediaFile(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    console.error(`Failed to walk ${dir}:`, e);
  }
}

scan();
