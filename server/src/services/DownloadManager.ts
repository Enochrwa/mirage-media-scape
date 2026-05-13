import { Database } from 'better-sqlite3';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Server } from 'socket.io';

export class DownloadManager {
  private queue: any[] = [];
  private activeCount = 0;
  private maxConcurrent = 3;
  private downloadsDir = path.join(os.homedir(), '.zovyra', 'downloads');

  constructor(private db: Database, private io?: Server) {
    if (!fs.existsSync(this.downloadsDir)) {
      fs.mkdirSync(this.downloadsDir, { recursive: true });
    }
    this.resumeDownloads();
  }

  async enqueue(trackId: string | null, episodeId: string | null, url: string, wifiOnly: boolean = true) {
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO downloads (id, track_id, episode_id, url, status, wifi_only, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, trackId, episodeId, url, wifiOnly ? 1 : 0, Date.now());

    this.processQueue();
  }

  private async resumeDownloads() {
    const pending = this.db.prepare("SELECT * FROM downloads WHERE status IN ('pending', 'downloading', 'waiting_wifi')").all();
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

  private async startDownload(download: any) {
    this.activeCount++;
    this.db.prepare("UPDATE downloads SET status = 'downloading' WHERE id = ?").run(download.id);

    const ext = path.extname(new URL(download.url).pathname) || '.mp3';
    const localPath = path.join(this.downloadsDir, `${download.id}${ext}`);
    const file = fs.createWriteStream(localPath);

    https.get(download.url, (res) => {
      const total = parseInt(res.headers['content-length'] || '0');
      let downloaded = 0;

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);

        if (this.io && downloaded % (1024 * 1024) === 0) {
          this.io.emit('DOWNLOAD_PROGRESS', { id: download.id, progress: downloaded / total, downloadedBytes: downloaded });
        }
      });

      res.on('end', () => {
        file.end();
        this.db.prepare("UPDATE downloads SET status = 'completed', local_path = ?, progress = 1, downloaded_bytes = ? WHERE id = ?")
          .run(localPath, downloaded, download.id);
        this.activeCount--;
        this.processQueue();
      });

    }).on('error', (err) => {
      this.handleError(download, err.message);
    });
  }

  private handleError(download: any, error: string) {
    const retryCount = (download.retry_count || 0) + 1;
    if (retryCount <= 3) {
      const backoff = [5000, 15000, 45000][retryCount - 1];
      setTimeout(() => {
        this.queue.push(download);
        this.processQueue();
      }, backoff);
      this.db.prepare("UPDATE downloads SET retry_count = ? WHERE id = ?").run(retryCount, download.id);
    } else {
      this.db.prepare("UPDATE downloads SET status = 'error', error = ? WHERE id = ?").run(error, download.id);
      this.activeCount--;
      this.processQueue();
    }
  }

  autoClean(maxAgeDays: number, maxSizeBytes: number) {
    // Implementation based on PlaybackEventService join would go here
  }
}

import crypto from 'crypto';
