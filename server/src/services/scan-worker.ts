import { parentPort, workerData, Worker } from 'node:worker_threads';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import native from '../utils/native-loader.js';
import type { AudioAnalysis } from '../../zovyra-native.js';
import type { Db } from './scan-processor.js';

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
  const allFiles = native.scanFolders(folders);
  const totalFiles = allFiles.length;

  parentPort?.postMessage({ type: 'SCAN_START', total: totalFiles });

  if (allFiles.length === 0) {
    parentPort?.postMessage({ type: 'SCAN_COMPLETE', scanned: 0, total: 0 });
    return;
  }

  const freeMB = os.freemem() / 1024 / 1024;
  const maxConcurrency = freeMB < 400 ? 1 : freeMB < 900 ? 2 : 4;
  const concurrency = Math.max(1, Math.min(maxConcurrency, allFiles.length));
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
          parentPort?.postMessage({
            type: 'SCAN_COMPLETE',
            scanned: totalScanned,
            total: totalFiles,
          });
        }
      }
    });

    worker.on('error', (err: Error) => {
      console.error('Chunk worker error:', err);
      completedChunks++;
      if (completedChunks === concurrency) {
        markMissingFiles();
        parentPort?.postMessage({
          type: 'SCAN_COMPLETE',
          scanned: totalScanned,
          total: totalFiles,
        });
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

}

scan();
