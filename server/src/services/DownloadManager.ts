import { Database } from 'better-sqlite3';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Server } from 'socket.io';
import crypto from 'crypto';

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
  ) {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `
      INSERT INTO downloads (id, track_id, episode_id, url, status, wifi_only, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `,
      )
      .run(id, trackId, episodeId, url, wifiOnly ? 1 : 0, Date.now());

    this.processQueue();
  }

  private async resumeDownloads() {
    const pending = this.db
      .prepare("SELECT * FROM downloads WHERE status IN ('pending', 'downloading', 'waiting_wifi')")
      .all() as DownloadItem[];
    this.queue = pending;
    this.processQueue();
  }

  private async processQueue() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) return;

    const next = this.queue.shift();
    if (!next) return;

    // Wifi check simplified for Node environment
    // In a real desktop app, we'd use Tauri's network plugin or similar
    if (next.wifi_only === 1 && !this.isWifi()) {
      this.db.prepare("UPDATE downloads SET status = 'waiting_wifi' WHERE id = ?").run(next.id);
      return;
    }

    this.startDownload(next);
  }

  private isWifi() {
    // Placeholder - assume true in Node environment for now
    return true;
  }

  private async startDownload(download: DownloadItem) {
    this.activeCount++;
    this.db.prepare("UPDATE downloads SET status = 'downloading' WHERE id = ?").run(download.id);

    const ext = path.extname(new URL(download.url).pathname) || '.mp3';
    const localPath = path.join(this.downloadsDir, `${download.id}${ext}`);
    const file = fs.createWriteStream(localPath);

    https
      .get(download.url, (res) => {
        const total = parseInt(res.headers['content-length'] || '0');
        let downloaded = 0;

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);

          if (this.io && downloaded % (1024 * 1024) === 0) {
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
      })
      .on('error', (err) => {
        this.handleError(download, err.message);
      });
  }

  private handleError(download: DownloadItem, error: string) {
    const retryCount = (download.retry_count || 0) + 1;
    if (retryCount <= 3) {
      const backoff = [5000, 15000, 45000][retryCount - 1];
      setTimeout(() => {
        this.queue.push(download);
        this.processQueue();
      }, backoff);
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

  autoClean(maxAgeDays: number, maxSizeBytes: number) {
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const threshold = Date.now() - maxAgeMs;
    const files = fs.readdirSync(this.downloadsDir).map((fileName) => {
      const filePath = path.join(this.downloadsDir, fileName);
      const stats = fs.statSync(filePath);
      return { fileName, filePath, stats };
    });

    for (const file of files) {
      if (file.stats.mtimeMs < threshold) {
        fs.rmSync(file.filePath, { force: true });
      }
    }

    let totalBytes = files.reduce((sum, file) => sum + file.stats.size, 0);
    if (totalBytes <= maxSizeBytes) return;

    const sortedByAge = [...files].sort((a, b) => a.stats.mtimeMs - b.stats.mtimeMs);
    for (const file of sortedByAge) {
      if (totalBytes <= maxSizeBytes) break;
      fs.rmSync(file.filePath, { force: true });
      totalBytes -= file.stats.size;
    }
  }
}

import crypto from 'crypto';
