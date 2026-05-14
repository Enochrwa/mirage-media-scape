import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import { processFile } from './scan-processor.js';

const { files, dbPath, coversDir } = workerData as {
  files: { path: string; mtime: number; size: number }[];
  dbPath: string;
  coversDir: string;
};

if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

let scanned = 0;
let lastReported = 0;
const total = files.length;
const newTracks: Array<unknown> = [];

function sendProgress() {
  const delta = scanned - lastReported;
  if (delta > 0) {
    parentPort?.postMessage({ type: 'SCAN_PROGRESS', delta });
    // Note: we only send delta; parent aggregates total
    lastReported = scanned;
  }
}

function sendNewTracks() {
  if (newTracks.length > 0) {
    parentPort?.postMessage({ type: 'NEW_TRACKS', tracks: newTracks });
    newTracks.length = 0;
  }
}

for (const file of files) {
  try {
    const track = processFile(file, db, coversDir);
    scanned++;
    if (track) {
      newTracks.push(track);
      if (newTracks.length >= 20) {
        sendNewTracks();
      }
    }
    if (scanned % 10 === 0) {
      sendProgress();
    }
  } catch (error) {
    console.error(`Failed to process ${file.path}:`, error);
  }
}

sendNewTracks();
sendProgress();

parentPort?.postMessage({ type: 'SCAN_CHUNK_COMPLETE', scanned, total });

db.close();
