import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Server } from 'socket.io';
import type { Database } from 'better-sqlite3';

type DownloadStatus = 'pending' | 'downloading' | 'waiting_wifi' | 'completed' | 'error';

interface DownloadItem {
  id: string;
  track_id: string | null;
  episode_id: string | null;
  url: string;
  status: DownloadStatus;
  wifi_only: number;
  retry_count: number;
  local_path?: string | null;
  progress: number;
  downloaded_bytes: number;
}

export class DownloadManager {
  private queue: DownloadItem[] = [];
  private activeCount = 0;
  private maxConcurrent = 3;
  private downloadsDir = path.join(os.homedir(), '.zovyra', 'downloads');

  constructor(
    private db: Database,
    private io?: Server,
  ) {
    if (!fs.existsSync(this.downloadsDir)) {
      fs.mkdirSync(this.downloadsDir, { recursive: true });
    }
    this.resumeDownloads();
  }

  async enqueue(
    trackId: string | null,
    episodeId: string | null,
    url: string,
    wifiOnly: boolean = true,
  ): Promise<void> {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO downloads (id, track_id, episode_id, url, status, wifi_only, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .run(id, trackId, episodeId, url, wifiOnly ? 1 : 0, Date.now());

    this.processQueue();
  }

  private resumeDownloads(): void {
    const pending = this.db
      .prepare("SELECT * FROM downloads WHERE status IN ('pending', 'downloading', 'waiting_wifi')")
      .all() as DownloadItem[];
    this.queue = pending;
    this.processQueue();
  }

  private processQueue(): void {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) return;

    const next = this.queue.shift();
    if (!next) return;

    if (next.wifi_only === 1 && !this.isWifi()) {
      this.db.prepare("UPDATE downloads SET status = 'waiting_wifi' WHERE id = ?").run(next.id);
      return;
    }

    this.startDownload(next);
  }

  private isWifi(): boolean {
    // Placeholder — assume true in Node environment
    return true;
  }

  private startDownload(download: DownloadItem): void {
    this.activeCount++;
    this.db.prepare("UPDATE downloads SET status = 'downloading' WHERE id = ?").run(download.id);

    let ext: string;
    try {
      ext = path.extname(new URL(download.url).pathname) || '.mp3';
    } catch {
      ext = '.mp3';
    }

    const localPath = path.join(this.downloadsDir, `${download.id}${ext}`);
    const file = fs.createWriteStream(localPath);

    https
      .get(download.url, (res) => {
        const total = parseInt(res.headers['content-length'] ?? '0', 10);
        let downloaded = 0;

        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          file.write(chunk);

          if (this.io && total > 0 && downloaded % (1024 * 1024) === 0) {
            this.io.emit('DOWNLOAD_PROGRESS', {
              id: download.id,
              progress: downloaded / total,
              downloadedBytes: downloaded,
            });
          }
        });

        res.on('end', () => {
          file.end();
          this.db
            .prepare(
              "UPDATE downloads SET status = 'completed', local_path = ?, progress = 1, downloaded_bytes = ? WHERE id = ?",
            )
            .run(localPath, downloaded, download.id);
          this.activeCount--;
          this.processQueue();
        });

        res.on('error', (err) => {
          file.destroy();
          this.handleError(download, err.message);
        });
      })
      .on('error', (err) => {
        file.destroy();
        this.handleError(download, err.message);
      });
  }

  private handleError(download: DownloadItem, error: string): void {
    const retryCount = (download.retry_count ?? 0) + 1;
    if (retryCount <= 3) {
      const backoffMs = [5000, 15000, 45000][retryCount - 1] ?? 45000;
      setTimeout(() => {
        this.queue.push({ ...download, retry_count: retryCount });
        this.processQueue();
      }, backoffMs);
      this.db
        .prepare('UPDATE downloads SET retry_count = ? WHERE id = ?')
        .run(retryCount, download.id);
    } else {
      this.db
        .prepare("UPDATE downloads SET status = 'error', error = ? WHERE id = ?")
        .run(error, download.id);
      this.activeCount--;
      this.processQueue();
    }
  }

  autoClean(maxAgeDays: number, maxSizeBytes: number): void {
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const threshold = Date.now() - maxAgeMs;

    const files = fs.readdirSync(this.downloadsDir).map((fileName) => {
      const filePath = path.join(this.downloadsDir, fileName);
      const stats = fs.statSync(filePath);
      return { fileName, filePath, stats };
    });

    // Remove files older than maxAgeDays
    for (const file of files) {
      if (file.stats.mtimeMs < threshold) {
        fs.rmSync(file.filePath, { force: true });
      }
    }

    // Evict oldest files if total size exceeds limit
    let totalBytes = files.reduce((sum, file) => sum + file.stats.size, 0);
    if (totalBytes <= maxSizeBytes) return;

    const sortedByAge = [...files].sort((a, b) => a.stats.mtimeMs - b.stats.mtimeMs);
    for (const file of sortedByAge) {
      if (totalBytes <= maxSizeBytes) break;
      if (fs.existsSync(file.filePath)) {
        fs.rmSync(file.filePath, { force: true });
        totalBytes -= file.stats.size;
      }
    }
  }
}
