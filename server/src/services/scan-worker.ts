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
  fingerprint: string | null;
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
const distChunkPath   = path.join(distWorkerDir, 'scan-chunk-worker.js');

// Detect dev mode: tsx is running if dist/ doesn't exist
const isProd = process.env.NODE_ENV === 'production';
let chunkWorkerPath = isProd ? path.join(__dirname, 'scan-chunk-worker.js') : distChunkPath;
let useChunkTsx = false;
if (!isProd && !fs.existsSync(chunkWorkerPath)) {
  chunkWorkerPath = path.join(__dirname, 'scan-chunk-worker.ts');
  useChunkTsx = true;
}

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
      fingerprint,
      last_modified, mtime, file_size, added_at, updated_at, missing
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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

  const saveTracksTransaction = (db as unknown as { transaction: (fn: (batch: BatchTrack[]) => void) => (batch: BatchTrack[]) => void }).transaction((batch: BatchTrack[]) => {
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
        t.fingerprint,
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
  const batchQueue: { path: string; mtime: number; size: number }[][] = [];
  const scannedPaths = new Set<string>();
  const MAX_QUEUE_DEPTH = 20;
  let scannerPaused = false;
  let resumeScanner: (() => void) | null = null;

  const processNextBatch = () => {
    if (batchQueue.length === 0 || activeWorkers >= maxConcurrency) {
      checkCompletion();
      return;
    }

    const files = batchQueue.shift()!;

    // Resume scanner if we've drained enough
    if (scannerPaused && batchQueue.length < MAX_QUEUE_DEPTH / 2) {
      scannerPaused = false;
      resumeScanner?.();
      resumeScanner = null;
    }
    activeWorkers++;

    let worker: Worker;
    if (workerPool.length > 0) {
      worker = workerPool.pop()!;
    } else {
      worker = new Worker(chunkWorkerPath, {
        workerData: { files: [], dbPath, coversDir },
        execArgv: useChunkTsx ? ['--import', 'tsx'] : [],
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
          processNextBatch();
        }
      });

      worker.on('error', (err: Error) => {
        console.error('Chunk worker error:', err);
        activeWorkers--;
        processNextBatch();
      });
    }

    worker.postMessage({ type: 'PROCESS_BATCH', files });
  };

  const checkCompletion = () => {
    if (rustScanComplete && activeWorkers === 0 && batchQueue.length === 0) {
      markMissingFiles(scannedPaths);
      parentPort?.postMessage({
        type: 'SCAN_COMPLETE',
        scanned: totalScanned,
        total: totalFiles,
      });
      // Cleanup pool
      for (const w of workerPool) w.terminate();
      db.close();
    }
  };

  native.scanFolders(folders, async (files: { path: string; mtime: number; size: number }[] | null) => {
    if (files === null) {
      rustScanComplete = true;
      checkCompletion();
    } else {
      // Backpressure: wait if queue is too deep
      if (batchQueue.length >= MAX_QUEUE_DEPTH) {
        scannerPaused = true;
        await new Promise<void>((resolve) => { resumeScanner = resolve; });
      }

      for (const f of files) scannedPaths.add(f.path);

      totalFiles += files.length;
      parentPort?.postMessage({ type: 'SCAN_PROGRESS', scanned: totalScanned, total: totalFiles });

      batchQueue.push(files);
      processNextBatch();
    }
  });

  function markMissingFiles(scannedPaths: Set<string>) {
    // db is already open
    const stmt = db.prepare('SELECT id, file_path FROM tracks WHERE missing = 0');
    const updateStmt = db.prepare('UPDATE tracks SET missing = 1 WHERE id = ?');
    const dbWithTx = db as unknown as { transaction: (fn: (rows: { id: string; file_path: string }[]) => void) => (rows: { id: string; file_path: string }[]) => void };
    const batch = dbWithTx.transaction((rows: { id: string; file_path: string }[]) => {
      for (const track of rows) {
        if (!scannedPaths.has(track.file_path)) {
          updateStmt.run(track.id);
        }
      }
    });
    const rows = [...(stmt.iterate() as Iterable<{ id: string; file_path: string }>)];
    batch(rows);
  }

}

scan();
