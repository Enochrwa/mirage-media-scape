import { Router } from 'express';
import db from '../db/index.js';
import { FingerprintService } from '../services/FingerprintService.js';
import { analysisService } from '../services/AnalysisService.js';
import native from '../utils/native-loader.js';
import { sanitizeId, validatePath } from '../utils/path-utils.js';

const router = Router();

router.post('/identify', async (req, res) => {
  const { id } = req.body;
  const safeId = sanitizeId(id);
  const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(safeId) as
    | { file_path: string }
    | undefined;

  if (!track || !track.file_path) {
    return res.status(404).json({ error: 'Track not found' });
  }

  if (!validatePath(track.file_path)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const metadata = await FingerprintService.identifyTrack(track.file_path, db);
  res.json({ data: metadata });
});

router.post('/write-tags', async (req, res) => {
  const { id, tags } = req.body;
  const safeId = sanitizeId(id);
  const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(safeId) as
    | { file_path: string }
    | undefined;

  if (!track || !track.file_path) {
    return res.status(404).json({ error: 'Track not found' });
  }

  if (!validatePath(track.file_path)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    native.writeTags(track.file_path, tags);
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

router.get('/analysis/status', (req, res) => {
  res.json(analysisService.getStatus());
});

router.post('/analysis/pause', (req, res) => {
  analysisService.pause();
  res.json({ success: true });
});

router.post('/analysis/resume', (req, res) => {
  analysisService.resume();
  res.json({ success: true });
});

export default router;
