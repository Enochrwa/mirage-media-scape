import chokidar, { type FSWatcher } from 'chokidar';
import path from 'path';
import type { Server } from 'socket.io';
import db from '../db/index.js';
import { scannerService } from './scanner.js';

let watcher: FSWatcher | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
let ioRef: Server | null = null;

const DEBOUNCE_MS = 500;

function scheduleRescan(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    scannerService
      .scanAll()
      .catch((e: unknown) => console.error('LibraryWatcher rescan failed:', e));
  }, DEBOUNCE_MS);
}

function markTrackMissing(filePath: string): void {
  db.prepare('UPDATE tracks SET missing = 1 WHERE file_path = ?').run(filePath);
}

function markTracksMissingUnderDir(dirPath: string): void {
  const normalized = dirPath.replace(/[/\\]+$/, '');
  const sep = path.sep;
  const escapeLike = (s: string): string =>
    s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const childPattern = `${escapeLike(normalized)}${escapeLike(sep)}%`;
  db.prepare(
    `UPDATE tracks SET missing = 1 WHERE file_path = ? OR file_path LIKE ? ESCAPE '\\'`,
  ).run(normalized, childPattern);
}

export function setLibraryWatcherIo(io: Server | null): void {
  ioRef = io;
}

export function refreshLibraryWatcherPaths(): void {
  const rows = db.prepare('SELECT path FROM watched_folders').all() as { path: string }[];

  if (watcher) {
    void watcher.close();
    watcher = null;
  }

  if (rows.length === 0) return;

  const paths = rows.map((r) => r.path);
  watcher = chokidar.watch(paths, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
  });

  watcher.on('unlink', (filePath: string) => {
    markTrackMissing(filePath);
    ioRef?.emit('LIBRARY_CHANGE', { type: 'MISSING', path: filePath });
  });

  watcher.on('unlinkDir', (dirPath: string) => {
    markTracksMissingUnderDir(dirPath);
    ioRef?.emit('LIBRARY_CHANGE', { type: 'MISSING_DIR', path: dirPath });
  });

  watcher.on('add', () => scheduleRescan());
  watcher.on('change', () => scheduleRescan());
  watcher.on('addDir', () => scheduleRescan());

  watcher.on('error', (err: unknown) => console.error('LibraryWatcher error:', err));
}
