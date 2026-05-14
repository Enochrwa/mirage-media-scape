import { Router } from 'express';
import db from '../db/index.js';
import { FingerprintService } from '../services/FingerprintService.js';
import native from '../utils/native-loader.js';

const router = Router();

router.post('/identify', async (req, res) => {
  const { path } = req.body;
  const metadata = await FingerprintService.identifyTrack(path, db);
  res.json({ data: metadata });
});

router.post('/write-tags', async (req, res) => {
  const { path, tags } = req.body;
  try {
    native.writeTags(path, tags);
    res.json({ data: { success: true } });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/sync/devices', (req, res) => {
  const devices = db.prepare('SELECT DISTINCT device_id FROM sync_log').all();
  res.json({ data: devices });
});

router.get('/duplicates/groups', async (_req, res) => {
  // Simplified duplicate detection logic would go here
  // typically joining on size/duration then verifying with native.generateWaveformFingerprint
  res.json({ data: [] });
});

export default router;