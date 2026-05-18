import { parentPort, workerData, Worker } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import native from '../utils/native-loader.js';
import type { AudioAnalysis } from '../../zovyra-native.js';
import type { Db } from './scan-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { dbPath, folders, coversDir } = workerData;

// In production the script runs from dist/src/services/ and .js files are present.
// In dev (tsx) __dirname points to src/services/ where only .ts files exist.
// Node.js ESM Worker threads cannot load .ts workers directly, so only .js is used.
const isDev =
  !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
const baseDir = isDev
  ? path.resolve(__dirname, '..', 'dist', 'src', 'services')
  : __dirname;
const chunkWorkerPath = path.resolve(baseDir, './scan-chunk-worker.js');

async function scan() {
  const allFiles = native.scanFolders(folders);
  const totalFiles = allFiles.length;

  parentPort?.postMessage({ type: 'SCAN_START', total: totalFiles });

  if (allFiles.length === 0) {
    parentPort?.postMessage({ type: 'SCAN_COMPLETE', scanned: 0, total: 0 });
    return;
  }

  const concurrency = Math.max(
    1,
    Math.min(parseInt(process.env.WORKER_THREADS || '4', 10), allFiles.length),
  );
  const chunkSize = Math.ceil(allFiles.length / concurrency);

  let totalScanned = 0;
  let completedChunks = 0;
  const pendingChunks = [];

  for (let i = 0; i < concurrency; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, allFiles.length);
    if (start >= allFiles.length) break;
    const chunk = allFiles.slice(start, end);

    const worker = new Worker(chunkWorkerPath, {
      workerData: { files: chunk, dbPath, coversDir },
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
        parentPort?.postMessage({ type: 'NEW_TRACKS', tracks: msg.tracks as unknown[] });
      } else if (msg.type === 'SCAN_CHUNK_COMPLETE') {
        const scanned = msg.scanned as number;
        totalScanned += scanned;
        completedChunks++;
        if (completedChunks === concurrency) {
          markMissingFiles();
          runBackgroundAnalysis();
        }
      }
    });

    worker.on('error', (err: Error) => {
      console.error('Chunk worker error:', err);
      completedChunks++;
      if (completedChunks === concurrency) {
        markMissingFiles();
        runBackgroundAnalysis();
      }
    });

    worker.on('exit', (code: number) => {
      if (code !== 0) {
        console.error(`Chunk worker exited with code ${code}`);
      }
    });

    pendingChunks.push(worker);
  }

  function markMissingFiles() {
    const db = new Database(dbPath) as unknown as Db;
    db.pragma('journal_mode = WAL');
    const dbTracks = db.prepare('SELECT id, file_path FROM tracks WHERE missing = 0').all() as {
      id: string;
      file_path: string;
    }[];
    for (const track of dbTracks) {
      if (!fs.existsSync(track.file_path)) {
        db.prepare('UPDATE tracks SET missing = 1 WHERE id = ?').run(track.id);
      }
    }
    db.close();
  }

  function runBackgroundAnalysis() {
    const db = new Database(dbPath) as unknown as Db;
    db.pragma('journal_mode = WAL');

    const unanalyzed = db
      .prepare(
        `SELECT id, file_path FROM tracks WHERE analysis_version IS NULL AND file_type = 'audio' AND missing = 0`,
      )
      .all() as { id: string; file_path: string }[];

    setImmediate(async () => {
      for (const track of unanalyzed) {
        try {
          const analysis: AudioAnalysis = native.analyzeAudio(track.file_path);
          db.prepare(
            `UPDATE tracks SET bpm = ?, key = ?, camelot_key = ?, energy = ?, loudness = ?, analysis_version = 1, updated_at = ? WHERE id = ?`,
          ).run(
            analysis.bpm,
            analysis.key,
            analysis.camelotKey,
            analysis.energy,
            analysis.loudness,
            Date.now(),
            track.id,
          );
          await new Promise((r) => setTimeout(r, 50));
        } catch (e) {
          console.error(`Analysis failed for ${track.file_path}`, e);
        }
      }
      db.close();
      parentPort?.postMessage({ type: 'SCAN_COMPLETE', scanned: totalScanned, total: totalFiles });
    });
  }
}

scan();
