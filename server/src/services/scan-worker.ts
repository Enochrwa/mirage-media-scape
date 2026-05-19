import { parentPort, workerData, Worker } from 'node:worker_threads';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import native from '../utils/native-loader.js';
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
    // Use streaming approach to check for missing files - process in batches
    // instead of loading all tracks into memory at once. This prevents OOM
    // on devices with large libraries (50,000+ tracks).
    const db = new Database(dbPath) as unknown as Db;
    db.pragma('journal_mode = WAL');
    
    // Process in batches to avoid loading all tracks into memory
    const batchSize = 500;
    let offset = 0;
    let checked = 0;
    let missing = 0;
    
    while (true) {
      // Fetch a batch of tracks
      const tracks = db.prepare(
        'SELECT id, file_path FROM tracks WHERE missing = 0 LIMIT ? OFFSET ?'
      ).all(batchSize, offset) as { id: string; file_path: string }[];
      
      if (tracks.length === 0) break;
      
      for (const track of tracks) {
        try {
          // Use try-catch with statSync instead of existsSync to handle race conditions
          // and avoid throwing on permission errors
          if (!fs.existsSync(track.file_path)) {
            db.prepare('UPDATE tracks SET missing = 1 WHERE id = ?').run(track.id);
            missing++;
          }
        } catch {
          // File access error - mark as missing
          db.prepare('UPDATE tracks SET missing = 1 WHERE id = ?').run(track.id);
          missing++;
        }
        checked++;
      }
      
      offset += batchSize;
      
      // Yield to event loop periodically
      if (offset % 5000 === 0) {
        parentPort?.postMessage({ 
          type: 'SCAN_PROGRESS', 
          scanned: offset, 
          total: offset,  // approximate
        });
      }
    }
    
    parentPort?.postMessage({ 
      type: 'MARK_MISSING_COMPLETE', 
      checked, 
      missing 
    });
    
    db.close();
  }

}

scan();
