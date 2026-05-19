import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { Server } from 'socket.io';
import db from '../db/index.js';
import native from '../utils/native-loader.js';
import { getDatabasePath } from '../utils/db-utils.js';
import { analysisService } from './AnalysisService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ScannerService {
  private io: Server | null = null;
  private isScanning = false;

  constructor(io: Server | null = null) {
    this.io = io;
  }

  setIo(io: Server): void {
    this.io = io;
  }

  /**
   * Scan a specific list of folders using a Worker thread.
   * Resolves when the worker has been launched (not when it completes —
   * progress is streamed via Socket.IO events).
   */
  async scan(folders: string[]): Promise<void> {
    if (this.isScanning) {
      console.warn('ScannerService: scan already in progress, skipping.');
      return;
    }
    if (folders.length === 0) return;

    this.isScanning = true;

    return new Promise<void>((resolve) => {
      // ── Worker path resolution ────────────────────────────────────────────
      // Directory layout:
      //   server/
      //   server/src/services/scanner.ts   ← __dirname here (dev, tsx watch)
      //   server/dist/src/services/        ← compiled worker output
      //
      // From __dirname (/…/server/src/services/) go UP TWO levels to server/:
      //   services/..  → server/src
      //   ../dist/src/services/  → server/dist/src/services/  ✓
      const srcServicesDir = path.resolve(__dirname);
      const serverRoot     = path.resolve(srcServicesDir, '..', '..');
      const distWorkerDir  = path.join(serverRoot, 'dist', 'src', 'services');
      const distWorkerPath = path.join(distWorkerDir, 'scan-worker.js');

      // In production (main process is dist/src/index.js) __dirname is already
      // dist/src/services/ so the worker is simply __dirname/scan-worker.js.
      const isProd = process.env.NODE_ENV === 'production';
      let workerPath = isProd ? path.join(__dirname, 'scan-worker.js') : distWorkerPath;

      const useTsx = !isProd && !existsSync(workerPath);
      if (useTsx) {
        workerPath = path.join(__dirname, 'scan-worker.ts');
      }

      const dbPath = getDatabasePath();
      const coversDir = path.resolve(path.dirname(dbPath), 'cache/covers');

      const worker = new Worker(workerPath, {
        workerData: { dbPath, folders, coversDir },
        execArgv: [
          ...(useTsx ? ['--import', 'tsx'] : []),
          '--max-old-space-size=512',
        ],
        resourceLimits: {
          maxOldGenerationSizeMb: 512,
        },
      });

      let resolved = false;
      worker.on('message', (msg: { type: string; [key: string]: unknown }) => {
        if (this.io) {
          this.io.emit(msg.type, msg);
        }
        if (msg.type === 'SCAN_COMPLETE' && !resolved) {
          resolved = true;
          this.isScanning = false;
          // Background analysis is now handled inside the scan worker (scan-worker.ts)
          // and marked with analysis_version=1 to avoid duplicate work here.
          // We call it here only as a fallback for any missed tracks.
          analysisService.startBackgroundAnalysis().catch(console.error);
          resolve();
        }
      });

      // log the GS), do NOT reject: isScanning is already false and the caller
      // already received SCAN_ERROR / SCAN_PROGRESS via Socket.IO.
      worker.on('error', (err) => {
        console.error('Scanner worker error:', err);
        this.isScanning = false;
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Scanner worker exited with code ${code}`);
        }
        this.isScanning = false;
      });
    });
  }

  /** Scan all folders stored in the database. */
  async scanAll(): Promise<void> {
    const rows = db.prepare('SELECT path FROM watched_folders').all() as { path: string }[];
    if (rows.length === 0) return;
    await this.scan(rows.map((f) => f.path));
  }

  async runBulkReplayGainScan(): Promise<void> {
    const unanalyzed = db
      .prepare(
        "SELECT id, file_path FROM tracks WHERE replaygain_track_gain IS NULL AND file_type = 'audio' AND missing = 0",
      )
      .all() as { id: string; file_path: string }[];

    if (unanalyzed.length === 0) return;

    this.io?.emit('REPLAYGAIN_SCAN_START', { total: unanalyzed.length });

    let scanned = 0;
    for (const track of unanalyzed) {
      try {
        const results = native.computeReplayGain([track.file_path]);
        const res = results[0];
        db.prepare(
          'UPDATE tracks SET replaygain_track_gain = ?, replaygain_track_peak = ?, updated_at = ? WHERE id = ?',
        ).run(res.trackGain, res.trackPeak, Date.now(), track.id);
        scanned++;
        this.io?.emit('REPLAYGAIN_SCAN_PROGRESS', { scanned, total: unanalyzed.length });
        // Yield to event loop
        await new Promise((resolve) => setImmediate(resolve));
      } catch (e) {
        console.error(`ReplayGain failed for ${track.file_path}`, e);
      }
    }
    this.io?.emit('REPLAYGAIN_SCAN_COMPLETE', { scanned, total: unanalyzed.length });
  }

  /**
   * Add a folder to the watch list and immediately scan it.
   * @param directory  Absolute path to the folder.
   * @param options.autoDiscovered  Whether the folder was found automatically (vs user-chosen).
   */
  async addFolder(directory: string, options?: { autoDiscovered?: boolean }): Promise<void> {
    const auto = options?.autoDiscovered ? 1 : 0;
    db.prepare(
      'INSERT OR IGNORE INTO watched_folders (path, added_at, auto_discovered) VALUES (?, ?, ?)',
    ).run(directory, Date.now(), auto);
    await this.scan([directory]);
  }

  /** Quick library statistics — does not require a Worker thread. */
  static getLibraryStats(): {
    totalTracks: number;
    totalDuration: number;
    artists: number;
    albums: number;
  } {
    const totalTracks = (
      db.prepare('SELECT COUNT(*) as count FROM tracks WHERE missing = 0').get() as {
        count: number;
      }
    ).count;

    const totalDuration = (
      db
        .prepare('SELECT COALESCE(SUM(duration), 0) as duration FROM tracks WHERE missing = 0')
        .get() as { duration: number }
    ).duration;

    const artists = (
      db
        .prepare(
          "SELECT COUNT(DISTINCT artist) as count FROM tracks WHERE missing = 0 AND artist IS NOT NULL AND artist != ''",
        )
        .get() as { count: number }
    ).count;

    const albums = (
      db
        .prepare(
          "SELECT COUNT(DISTINCT album) as count FROM tracks WHERE missing = 0 AND album IS NOT NULL AND album != ''",
        )
        .get() as { count: number }
    ).count;

    return { totalTracks, totalDuration, artists, albums };
  }
}

export const scannerService = new ScannerService();
