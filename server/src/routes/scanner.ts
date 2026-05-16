import { Router } from 'express';
import { scannerService, ScannerService } from '../services/scanner.js';
import { getOSMediaDirectories } from '../utils/os-defaults.js';
import db from '../db/index.js';

const router = Router();
export { scannerService };

// Auto-scan OS default media directories (called by desktop app on startup)
router.post('/auto-scan-defaults', async (req, res) => {
  const dirs = getOSMediaDirectories();
  for (const dir of dirs) {
    db.prepare(
      'INSERT OR IGNORE INTO watched_folders (path, added_at, auto_discovered) VALUES (?, ?, 1)',
    ).run(dir, Date.now());
  }
  // Fire and forget — don't await, let it run in background
  scannerService.scanAll().catch(console.error);
  res.json({ data: { dirs, message: 'Auto-scan started' } });
});

router.post('/scan', async (req, res) => {
  await scannerService.scanAll();
  res.json({ data: { message: 'Scan started' } });
});

router.get('/stats', async (req, res) => {
  const stats = await ScannerService.getLibraryStats();
  res.json({ data: stats });
});

export default router;
