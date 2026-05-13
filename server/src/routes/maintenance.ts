import { Router } from 'express';
import db from '../db';
import { FingerprintService } from '../services/FingerprintService';
import { createRequire } from 'node:module';

const requireNative = createRequire(__filename);
const native = requireNative('../../zovyra-native.node') as typeof import('../../zovyra-native');

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
  const devices = db.prepare("SELECT DISTINCT device_id FROM sync_log").all();
  res.json({ data: devices });
});

router.get('/duplicates/groups', async (req, res) => {
  // Simplified duplicate detection logic would go here
  // typically joining on size/duration then verifying with native.generateWaveformFingerprint
  res.json({ data: [] });
});

export default router;
