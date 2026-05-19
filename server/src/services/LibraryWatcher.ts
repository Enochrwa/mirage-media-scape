import chokidar, { type FSWatcher } from 'chokidar';
import path from 'path';
import type { Server } from 'socket.io';
import db from '../db/index.js';
import { scannerService } from './scanner.js';

let watcher: FSWatcher | null = null;
let ioRef: Server | null = null;

const DEBOUNCE_MS     = 2_000;   // normal debounce after library changes
const BACKOFF_INITIAL = 15_000;  // delay after a failed scan
const BACKOFF_MAX     = 60_000;  // maximum backoff cap

let lastScanFailed  = false;
let backoffMs       = BACKOFF_INITIAL;
let isScanning      = false;

// Track whether any filesystem changes occurred since the last scan completed.
// Only re-scan if actual changes were detected.
let pendingChanges  = false;

// Debounce timer reference
let debounceTimerRef: NodeJS.Timeout | null = null;

function scheduleRescan(): void {
  // If the last scan failed, advance the backoff timer so the *next* attempt
  // always waits the full backoff delay regardless of how many events fire in
  // the meantime.
  if (lastScanFailed && debounceTimerRef) {
    clearTimeout(debounceTimerRef);
    debounceTimerRef = null;
  }

  // ── Scanning in progress ──────────────────────────────────────────
  // A scan is already running (runScan is active, isScanning === true).
  // Mark that changes are pending so a scan will run after current completes.
  if (isScanning) {
    pendingChanges = true;
    return;
  }

  const delay = lastScanFailed ? backoffMs : DEBOUNCE_MS;
  debounceTimerRef = setTimeout(runScan, delay);
}

function runScan(): void {
  debounceTimerRef = null;          // consume the timer slot
  isScanning      = true;            // guard: drop all events until this finishes
  lastScanFailed  = false;           // optimistic — will flip back if the scan throws
  backoffMs       = BACKOFF_INITIAL;

  (async () => {
    try {
      await scannerService.scanAll();   // scan — OR SCAN_COMPLETE resolves
      // success: leave isScanning = true until finally resets it below
    } catch (e: unknown) {
      lastScanFailed = true;
      backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX);
      console.error('LibraryWatcher rescan failed:', e);
    } finally {
      isScanning = false;
      
      // Only schedule another scan if actual filesystem changes were detected
      // while we were scanning. This prevents the runaway re-scan loop that
      // constantly kept the scanner running even when nothing changed.
      if (pendingChanges) {
        pendingChanges = false;
        debounceTimerRef = setTimeout(runScan, DEBOUNCE_MS);
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

export function refreshLibraryWatcherPaths(): void {
  const rows = db.prepare('SELECT path FROM watched_folders').all() as { path: string }[];

  if (watcher) {
    void watcher.close();
    watcher = null;
  }

  // Cancel any pending timers and reset scan state
  if (debounceTimerRef) clearTimeout(debounceTimerRef);
  debounceTimerRef = null;
  isScanning = false;
  // Reset pending changes since we're rebuilding the watcher from scratch
  pendingChanges = false;

  if (rows.length === 0) return;

  const paths = rows.map((r) => r.path);
  watcher = chokidar.watch(paths, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
    ignored: [
      /^.*[/\\]systemd-private-.*$/,
      /^\/tmp[/\\]$/,
      // Ignore common non-media directories
      '**/node_modules/**',
      '**/.*/**',
      // Ignore known non-media file patterns
      '**/*.{jpg,jpeg,png,gif,bmp,tiff,ico,webp,svg}',
      '**/*.{db,sqlite,sqlite3}',
      '**/*.{log,tmp,temp}',
      '**/Thumbs.db',
      '**/desktop.ini',
    ],
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

  watcher.on('error', (err: unknown) => {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'EACCES') {
      return;
    }
    console.error('LibraryWatcher error:', err);
  });
}
