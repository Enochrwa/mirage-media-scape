import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import db from '../db/index.js';
import { getDatabasePath } from '../utils/db-utils.js';

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

    return new Promise<void>((resolve, reject) => {
      // The compiled scan-worker.js sits in dist/src/services/ after tsc.
      const workerPath = path.resolve(__dirname, './scan-worker.js');
      const dbPath = getDatabasePath();
      const coversDir = path.resolve(path.dirname(dbPath), 'cache/covers');

      const worker = new Worker(workerPath, {
        workerData: { dbPath, folders, coversDir },
      });

      worker.on('message', (msg: { type: string; [key: string]: unknown }) => {
        if (this.io) {
          this.io.emit(msg.type, msg);
        }
        if (msg.type === 'SCAN_COMPLETE') {
          this.isScanning = false;
          resolve();
        }
      });

      worker.on('error', (err) => {
        console.error('Scanner worker error:', err);
        this.isScanning = false;
        reject(err);
      });

      worker.on('exit', (code) => {
        this.isScanning = false;
        if (code !== 0) {
          console.error(`Scanner worker exited with code ${code}`);
          // Resolve rather than reject so callers don't crash on partial scans
          resolve();
        }
      });
    });
  }

  /** Scan all folders stored in the database. */
  async scanAll(): Promise<void> {
    const rows = db
      .prepare('SELECT path FROM watched_folders')
      .all() as { path: string }[];
    if (rows.length === 0) return;
    await this.scan(rows.map((f) => f.path));
  }

  /**
   * Add a folder to the watch list and immediately scan it.
   * @param directory  Absolute path to the folder.
   * @param options.autoDiscovered  Whether the folder was found automatically (vs user-chosen).
   */
  async addFolder(
    directory: string,
    options?: { autoDiscovered?: boolean },
  ): Promise<void> {
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
