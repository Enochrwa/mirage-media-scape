import { parentPort, workerData, Worker } from 'node:worker_threads';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import native from '../utils/native-loader.js';
import type { Db } from './scan-processor.js';
import type { TrackMetadata } from '../../zovyra-native.js';

interface BatchTrack {
  id: string;
  file_path: string;
  file_type: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  album_artist: string | null;
  year: number | null;
  genre: string | null;
  track_number: number | null;
  disc_number: number | null;
  duration: number;
  sample_rate: number | null;
  bitrate: number | null;
  channels: number | null;
  codec: string | null;
  replaygain_track_gain: number | null;
  replaygain_track_peak: number | null;
  replaygain_album_gain: number | null;
  replaygain_album_peak: number | null;
  encoder_delay: number | null;
  encoder_padding: number | null;
  chaptersJson: string | null;
  cover_cache_path: string | null;
  thumbnail_path: string | null;
  last_modified: number;
  mtime: number;
  file_size: number;
  metadata: TrackMetadata;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { dbPath, folders, coversDir } = workerData;

// Directory layout (same logic as scanner.ts):
//   src/services/scan-worker.ts  ← __dirname here in dev
//   server/dist/src/services/scan-chunk-worker.js  ← compiled output in dist/
//
// From __dirname (/…/server/src/services/) go UP TWO levels to server/:
//   services/..  → server/src
//   ../dist/src/services/  → server/dist/src/services/  ✓
const srcServicesDir  = path.resolve(__dirname);
const serverRoot      = path.resolve(srcServicesDir, '..', '..');
const distWorkerDir   = path.join(serverRoot, 'dist', 'src', 'services');
const chunkWorkerPath = path.join(distWorkerDir, 'scan-chunk-worker.js');

async function scan() {
  const db = new Database(dbPath) as unknown as Db;
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  const insertTrackStmt = db.prepare(`
    INSERT OR REPLACE INTO tracks (
      id, file_path, file_type, title, artist, album, album_artist,
      year, genre, track_number, disc_number, duration,
      sample_rate, bitrate, channels, codec,
      replaygain_track_gain, replaygain_track_peak,
      replaygain_album_gain, replaygain_album_peak,
      encoder_delay, encoder_padding,
      waveform_data, metadata_json,
      cover_cache_path, thumbnail_path,
      last_modified, mtime, file_size, added_at, updated_at, missing
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const deleteChaptersStmt = db.prepare('DELETE FROM track_chapters WHERE track_id = ?');
  const insertChapterStmt = db.prepare(`
    INSERT INTO track_chapters (track_id, chapter_index, title, start_time_ms, end_time_ms)
    VALUES (?, ?, ?, ?, ?)
  `);

  const deleteAudioStreamsStmt = db.prepare('DELETE FROM track_audio_streams WHERE track_id = ?');
  const insertAudioStreamStmt = db.prepare(`
    INSERT INTO track_audio_streams (track_id, stream_index, language, codec_name, channels, sample_rate)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const deleteSubtitleStreamsStmt = db.prepare('DELETE FROM track_subtitle_streams WHERE track_id = ?');
  const insertSubtitleStreamStmt = db.prepare(`
    INSERT INTO track_subtitle_streams (track_id, stream_index, language, codec_name)
    VALUES (?, ?, ?, ?)
  `);

  const saveTracksTransaction = (db as any).transaction((batch: BatchTrack[]) => {
    const now = Date.now();
    for (const t of batch) {
      insertTrackStmt.run(
        t.id, t.file_path, t.file_type, t.title, t.artist, t.album, t.album_artist,
        t.year, t.genre, t.track_number, t.disc_number, t.duration,
        t.sample_rate, t.bitrate, t.channels, t.codec,
        t.replaygain_track_gain, t.replaygain_track_peak,
        t.replaygain_album_gain, t.replaygain_album_peak,
        t.encoder_delay, t.encoder_padding,
        null, t.chaptersJson, t.cover_cache_path, t.thumbnail_path,
        t.last_modified, t.mtime, t.file_size, now, now
      );

      // Sub-tables
      const meta = t.metadata;

      deleteChaptersStmt.run(t.id);
      if (meta.chapters && meta.chapters.length > 0) {
        for (const c of meta.chapters) {
          insertChapterStmt.run(t.id, c.index, c.title ?? null, c.startTimeMs, c.endTimeMs);
        }
      }

      deleteAudioStreamsStmt.run(t.id);
      if (meta.audioStreams && meta.audioStreams.length > 0) {
        for (const s of meta.audioStreams) {
          insertAudioStreamStmt.run(t.id, s.index, s.language ?? null, s.codecName ?? null, s.channels ?? null, s.sampleRate ?? null);
        }
      }

      deleteSubtitleStreamsStmt.run(t.id);
      if (meta.subtitleStreams && meta.subtitleStreams.length > 0) {
        for (const s of meta.subtitleStreams) {
          insertSubtitleStreamStmt.run(t.id, s.index, s.language ?? null, s.codecName ?? null);
        }
      }
    }
  });

  parentPort?.postMessage({ type: 'SCAN_START', total: 0 });

  const freeMB = os.freemem() / 1024 / 1024;
  const maxConcurrency = freeMB < 400 ? 1 : freeMB < 900 ? 2 : 4;

  let totalFiles = 0;
  let totalScanned = 0;
  let activeWorkers = 0;
  let rustScanComplete = false;

  const workerPool: Worker[] = [];

  const getWorker = () => {
    if (workerPool.length > 0) return workerPool.pop()!;
    const worker = new Worker(chunkWorkerPath, {
      workerData: { files: [], dbPath, coversDir }, // Dummy files, we will use postMessage
    });

    worker.on('message', (msg: { type: string; [key: string]: unknown }) => {
      if (msg.type === 'SCAN_PROGRESS') {
        const delta = msg.delta as number;
        totalScanned += delta;
        parentPort?.postMessage({
          type: 'SCAN_PROGRESS',
          scanned: totalScanned,
          total: totalFiles,
        });
      } else if (msg.type === 'NEW_TRACKS') {
        const tracks = msg.tracks as BatchTrack[];
        saveTracksTransaction(tracks);
        parentPort?.postMessage({ type: 'NEW_TRACKS', tracks });
      } else if (msg.type === 'SCAN_CHUNK_COMPLETE') {
        activeWorkers--;
        workerPool.push(worker);
        checkCompletion();
      }
    });

    worker.on('error', (err: Error) => {
      console.error('Chunk worker error:', err);
      activeWorkers--;
      checkCompletion();
    });

    return worker;
  };

  const checkCompletion = () => {
    if (rustScanComplete && activeWorkers === 0) {
      markMissingFiles();
      parentPort?.postMessage({
        type: 'SCAN_COMPLETE',
        scanned: totalScanned,
        total: totalFiles,
      });
      // Cleanup pool
      for (const w of workerPool) w.terminate();
    }
  };

  native.scanFolders(folders, (files: { path: string; mtime: number; size: number }[] | null) => {
    if (files === null) {
      rustScanComplete = true;
      checkCompletion();
    } else {
      totalFiles += files.length;
      parentPort?.postMessage({ type: 'SCAN_PROGRESS', scanned: totalScanned, total: totalFiles });

      // Send batch to a worker
      activeWorkers++;
      const worker = getWorker();
      worker.postMessage({ type: 'PROCESS_BATCH', files });
    }
  });

  function markMissingFiles() {
    // db is already open
    const stmt = db.prepare('SELECT id, file_path FROM tracks WHERE missing = 0');
    const updateStmt = db.prepare('UPDATE tracks SET missing = 1 WHERE id = ?');

    for (const track of (stmt as any).iterate() as { id: string; file_path: string }) {
      if (!fs.existsSync(track.file_path)) {
        updateStmt.run(track.id);
      }
    }
  }

}

scan();
