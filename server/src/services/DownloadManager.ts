import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'https';
import crypto from 'crypto';

export class DownloadManager {
  private activeDownloads = 0;
  private maxConcurrent = 3;

  constructor(private db: Database.Database, private downloadDir: string) {
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
  }

  public async queueDownload(url: string, trackId?: string, episodeId?: string) {
    // Basic SSRF validation
    const validatedUrl = new URL(url);
    if (validatedUrl.protocol !== 'http:' && validatedUrl.protocol !== 'https:') {
      throw new Error('Invalid protocol for download');
    }

    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO downloads (id, track_id, episode_id, url, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(id, trackId || null, episodeId || null, validatedUrl.toString(), Date.now());

    this.processQueue();
    return id;
  }

  private async processQueue() {
    if (this.activeDownloads >= this.maxConcurrent) return;

    const pending = this.db.prepare(`
      SELECT * FROM downloads WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1
    `).get() as any;

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
