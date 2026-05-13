import { Router } from 'express';
import db from '../db';
import { DownloadManager } from '../services/DownloadManager';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();
const dlManager = new DownloadManager(db);

router.post('/', async (req, res) => {
  const { trackId, episodeId, url, wifiOnly } = req.body;
  await dlManager.enqueue(trackId, episodeId, url, wifiOnly);
  res.json({ data: { success: true } });
});

router.get('/', (req, res) => {
  const downloads = db.prepare("SELECT * FROM downloads ORDER BY created_at DESC").all();
  res.json({ data: downloads });
});

router.delete('/:id', (req, res) => {
  const dl = db.prepare("SELECT local_path FROM downloads WHERE id = ?").get(req.params.id) as { local_path?: string };
  if (dl?.local_path && fs.existsSync(dl.local_path)) {
    fs.unlinkSync(dl.local_path);
  }
  db.prepare("DELETE FROM downloads WHERE id = ?").run(req.params.id);
  res.json({ data: { success: true } });
});

router.get('/storage-info', (req, res) => {
  const downloadsDir = path.join(os.homedir(), '.zovyra', 'downloads');
  let totalSize = 0;
  if (fs.existsSync(downloadsDir)) {
    const files = fs.readdirSync(downloadsDir);
    for (const f of files) {
      totalSize += fs.statSync(path.join(downloadsDir, f)).size;
    }
  }
  res.json({ data: { totalSizeBytes: totalSize, path: downloadsDir } });
});

export default router;
