import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { UrlValidator } from '../utils/UrlValidator';

export class DownloadManager {
  private activeDownloads = 0;
  private maxConcurrent = 3;

  private isWifi = true; // Default to true, in a real app this would be updated by system events

  constructor(private db: Database.Database, private downloadDir: string) {
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
  }

  public setWifiStatus(isWifi: boolean) {
    this.isWifi = isWifi;
    if (isWifi) this.processQueue();
  }

  public async queueDownload(urlStr: string, trackId?: string, episodeId?: string, wifiOnly: boolean = true) {
    const url = new URL(urlStr);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }

    if (UrlValidator.isPrivate(url.hostname)) {
      throw new Error('Private network access prohibited');
    }

    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO downloads (id, track_id, episode_id, url, status, created_at, wifi_only)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, trackId || null, episodeId || null, url.toString(), Date.now(), wifiOnly ? 1 : 0);

    this.processQueue();
    return id;
  }

  private async processQueue() {
    if (this.activeDownloads >= this.maxConcurrent) return;

    let query = `SELECT * FROM downloads WHERE status = 'pending'`;
    if (!this.isWifi) {
      query += ` AND wifi_only = 0`;
    }
    query += ` ORDER BY priority DESC, created_at ASC LIMIT 1`;

    const pending = this.db.prepare(query).get() as any;

    if (!pending) return;

    this.activeDownloads++;
    this.startDownload(pending);
    this.processQueue();
  }

  private startDownload(task: any) {
    const ext = path.extname(new URL(task.url).pathname) || '.mp3';
    const localPath = path.join(this.downloadDir, `${task.id}${ext}`);
    const file = fs.createWriteStream(localPath);

    const protocol = task.url.startsWith('https') ? https : http;

    this.db.prepare("UPDATE downloads SET status = 'downloading', local_path = ? WHERE id = ?")
      .run(localPath, task.id);

    protocol.get(task.url, (res) => {
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;

      this.db.prepare("UPDATE downloads SET file_size = ? WHERE id = ?").run(total, task.id);

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);

        // Update progress occasionally
        if (downloaded % (1024 * 1024) === 0 || downloaded === total) {
           this.db.prepare("UPDATE downloads SET progress = ?, downloaded_bytes = ? WHERE id = ?")
             .run(downloaded / total, downloaded, task.id);
        }
      });

      res.on('end', () => {
        file.end();
        this.db.prepare("UPDATE downloads SET status = 'completed', progress = 1 WHERE id = ?")
          .run(task.id);
        this.activeDownloads--;
        this.processQueue();
      });

    }).on('error', (err) => {
      console.error('Download error:', err);
      this.db.prepare("UPDATE downloads SET status = 'failed', error = ? WHERE id = ?")
        .run(err.message, task.id);
      this.activeDownloads--;
      this.processQueue();
    });
  }
}
