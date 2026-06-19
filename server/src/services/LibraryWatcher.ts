import chokidar, { type FSWatcher } from 'chokidar';
import path from 'path';
import type { Server } from 'socket.io';
import db from '../db/index.js';
import { scannerService } from './scanner.js';

let watcher: FSWatcher | null = null;
let ioRef: Server | null = null;

const DEBOUNCE_MS = 2_000;
const BACKOFF_INITIAL = 15_000;
const BACKOFF_MAX = 60_000;

let lastScanFailed = false;
let backoffMs = BACKOFF_INITIAL;
let isScanning = false;
let pendingChanges = false;

let debounceTimerRef: NodeJS.Timeout | null = null;
let emfileRetryTimer: NodeJS.Timeout | null = null;
let usePollingFallback = false;

function scheduleRescan(): void {
  if (lastScanFailed && debounceTimerRef) {
    clearTimeout(debounceTimerRef);
    debounceTimerRef = null;
  }
  if (isScanning) {
    pendingChanges = true;
    return;
  }
  const delay = lastScanFailed ? backoffMs : DEBOUNCE_MS;
  debounceTimerRef = setTimeout(runScan, delay);
}

function runScan(): void {
  debounceTimerRef = null;
  isScanning = true;
  pendingChanges = false;
  lastScanFailed = false;
  backoffMs = BACKOFF_INITIAL;

  (async () => {
    try {
      await scannerService.scanAll();
    } catch (e: unknown) {
      lastScanFailed = true;
      backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX);
      console.error('LibraryWatcher rescan failed:', e);
    } finally {
      isScanning = false;
      if (pendingChanges) {
        debounceTimerRef = setTimeout(() => {
          debounceTimerRef = null;
          if (!isScanning) runScan();
        }, 5_000);
      }
    }
  })();
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

function buildWatcherOptions(polling: boolean): import('chokidar').ChokidarOptions {
  const baseOpts: import('chokidar').ChokidarOptions = {
    ignoreInitial: true,
    persistent: true,
    followSymlinks: false,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
    // Limit depth to avoid watching enormous trees
    depth: 10,
    ignored: [
      /^.*[/\\]systemd-private-.*$/,
      /^\/tmp[/\\]$/,
      /[/\\]\.wine[^/\\]*/,
      /[/\\]dosdevices[/\\]/,
      '**/node_modules/**',
      '**/.*/**',
      '**/*.{jpg,jpeg,png,gif,bmp,tiff,ico,webp,svg}',
      '**/*.{db,sqlite,sqlite3}',
      '**/*.{log,tmp,temp}',
      '**/Thumbs.db',
      '**/desktop.ini',
    ],
  };

  if (polling) {
    // Polling fallback: much lower fd pressure, works on network mounts
    return {
      ...baseOpts,
      usePolling: true,
      interval: 5_000, // check every 5 s
      binaryInterval: 10_000, // binary files every 10 s
      // Polling doesn't need awaitWriteFinish because interval is long enough
      awaitWriteFinish: { stabilityThreshold: 2_000, pollInterval: 500 },
    };
  }

  return {
    ...baseOpts,
    // Native fs.watch — guard against opening too many fds
    // by limiting the number of simultaneously watched paths
    usePolling: false,
  };
}

async function startWatcher(paths: string[], polling: boolean): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }

  watcher = chokidar.watch(paths, buildWatcherOptions(polling));

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

  watcher.on('error', (err: unknown) => {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as NodeJS.ErrnoException).code;

      if (code === 'EACCES' || code === 'EPERM') {
        console.warn(
          `LibraryWatcher: skipping inaccessible path — ${(err as NodeJS.ErrnoException).path}`,
        );
        return;
      }

      if (code === 'EMFILE' || code === 'ENFILE') {
        // Too many open files — fall back to polling mode
        if (!usePollingFallback) {
          console.warn(
            '[LibraryWatcher] EMFILE: too many open files. ' +
              'Switching to polling mode (lower fd pressure). ' +
              'To fix permanently, run: ulimit -n 65536',
          );
          usePollingFallback = true;

          // Debounce the restart so we don't thrash during an EMFILE storm
          if (emfileRetryTimer) clearTimeout(emfileRetryTimer);
          emfileRetryTimer = setTimeout(async () => {
            emfileRetryTimer = null;
            const rows = db.prepare('SELECT path FROM watched_folders').all() as { path: string }[];
            if (rows.length > 0) {
              await startWatcher(
                rows.map((r) => r.path),
                true,
              );
              console.info('[LibraryWatcher] Restarted in polling mode.');
            }
          }, 3_000);
        }
        return; // suppress the flood of EMFILE messages
      }
    }
    console.error('LibraryWatcher error:', err);
  });
}

export async function refreshLibraryWatcherPaths(): Promise<void> {
  const rows = db.prepare('SELECT path FROM watched_folders').all() as { path: string }[];

  // Cancel any pending timers and reset scan state
  if (debounceTimerRef) clearTimeout(debounceTimerRef);
  if (emfileRetryTimer) clearTimeout(emfileRetryTimer);
  debounceTimerRef = null;
  emfileRetryTimer = null;
  isScanning = false;
  usePollingFallback = false; // reset on explicit refresh

  if (rows.length === 0) {
    if (watcher) {
      await watcher.close();
      watcher = null;
    }
    return;
  }

  await startWatcher(
    rows.map((r) => r.path),
    false,
  );
}
