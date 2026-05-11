import { Worker } from 'worker_threads';
import path from 'path';
import { Server } from 'socket.io';
import db from '../db';

export class ScannerService {
  private io: Server | null = null;
  private isScanning = false;

  constructor(io: Server | null = null) {
    this.io = io;
  }

  setIo(io: Server) {
    this.io = io;
  }

  async scan(folders: string[]) {
    if (this.isScanning) return;
    this.isScanning = true;

    const worker = new Worker(path.resolve(__dirname, './scan-worker.js'), {
      workerData: {
        dbPath: path.resolve(__dirname, '../../zovyra.db'),
        folders,
        coversDir: path.resolve(__dirname, '../../cache/covers'),
      },
    });

    worker.on('message', (msg) => {
      if (this.io) {
        this.io.emit(msg.type, msg);
      }
      if (msg.type === 'SCAN_COMPLETE') {
        this.isScanning = false;
      }
    });

    worker.on('error', (err) => {
      console.error('Scanner worker error:', err);
      this.isScanning = false;
    });
  }

  async scanAll() {
    const folders = db.prepare('SELECT path FROM watched_folders').all() as { path: string }[];
    if (folders.length > 0) {
      await this.scan(folders.map(f => f.path));
    }
  }

  async addFolder(directory: string, options?: { autoDiscovered?: boolean }) {
    const auto = options?.autoDiscovered ? 1 : 0;
    db.prepare('INSERT OR IGNORE INTO watched_folders (path, added_at, auto_discovered) VALUES (?, ?, ?)').run(
      directory,
      Date.now(),
      auto,
    );
    await this.scan([directory]);
  }

  static async getLibraryStats() {
    const totalTracks = db.prepare('SELECT COUNT(*) as count FROM tracks').get() as {
      count: number;
    };
    const totalDuration = db.prepare('SELECT SUM(duration) as duration FROM tracks').get() as {
      duration: number;
    };
    const artists = db.prepare('SELECT COUNT(DISTINCT artist) as count FROM tracks').get() as {
      count: number;
    };

    return {
      totalTracks: totalTracks.count,
      totalDuration: totalDuration.duration || 0,
      artists: artists.count,
    };
  }
}

export const scannerService = new ScannerService();
