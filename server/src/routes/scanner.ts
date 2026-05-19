import { Router } from 'express';
import { scannerService, ScannerService } from '../services/scanner.js';
import { getOSMediaDirectories } from '../utils/os-defaults.js';
import db from '../db/index.js';
import { validatePath } from '../utils/path-utils.js';
import { postOnboardingChooseFolder, postOnboardingHome, postOnboardingDismiss, getBootstrap } from '../controllers/scannerController.js';

const router = Router();
export { scannerService };

// Onboarding routes
router.post('/onboarding/home',         postOnboardingHome);
router.post('/onboarding/choose-folder', postOnboardingChooseFolder);
router.post('/onboarding/dismiss',      postOnboardingDismiss);
router.get('/onboarding/bootstrap',     getBootstrap);
// Alias so the web client (which calls /api/scanner/bootstrap) works too
router.get('/bootstrap',                getBootstrap);

// Auto-scan OS default media directories (called by desktop app on startup)
router.post('/auto-scan-defaults', async (req, res) => {
  const dirs = getOSMediaDirectories();
  for (const dir of dirs) {
    // We trust getOSMediaDirectories, but let's be safe
    db.prepare(
      'INSERT OR IGNORE INTO watched_folders (path, added_at, auto_discovered) VALUES (?, ?, 1)',
    ).run(dir, Date.now());
  }
  // Fire and forget — don't await, let it run in background
  scannerService.scanAll().catch(console.error);
  res.json({ data: { dirs, message: 'Auto-scan started' } });
});

router.post('/scan', async (req, res) => {
  const { directory } = req.body;
  if (directory) {
    if (!validatePath(directory)) {
      return res.status(403).json({ error: 'Access denied to directory' });
    }
    await scannerService.addFolder(directory);
  } else {
    await scannerService.scanAll();
  }
  res.json({ data: { message: 'Scan started' } });
});

router.get('/stats', async (req, res) => {
  const stats = await ScannerService.getLibraryStats();
  res.json({ data: stats });
});

/** POST /api/library/replaygain-scan */
router.post('/replaygain-scan', async (req, res) => {
  // Fire and forget background job
  scannerService.runBulkReplayGainScan().catch(console.error);
  res.json({ data: { message: 'ReplayGain scan started' } });
});

// Web File System Access API - receive files scanned client-side
router.post('/scan-web-files', async (req, res) => {
  const { files, folderName } = req.body;
  
  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: 'Invalid files array' });
  }
  
  // Store folder in watched_folders (with web prefix to indicate it's from web)
  const webFolderPath = `web://${folderName}`;
  db.prepare(
    'INSERT OR IGNORE INTO watched_folders (path, added_at, auto_discovered) VALUES (?, ?, 0)',
  ).run(webFolderPath, Date.now());
  
  // Process files - we'd need a special handler for web files
  // Since we can't access file paths directly, we store the metadata
  // and create file:// URLs for playback
  for (const file of files) {
    try {
      // Create a unique ID
      const id = `web-${Buffer.from(file.path).toString('base64').slice(0, 20)}`;
      
      db.prepare(`
        INSERT OR REPLACE INTO tracks (
          id, file_path, file_type, title, duration, mtime, file_size, missing, added_at, updated_at
        ) VALUES (?, ?, 'audio', ?, 0, ?, ?, 0, ?, ?)
      `).run(
        id,
        file.path,  // Store as file path for web playback
        file.path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Unknown',
        file.mtime,
        file.size,
        Date.now(),
        Date.now(),
      );
    } catch (e) {
      console.error('Error processing web file:', e);
    }
  }
  
  res.json({ data: { message: 'Files processed', count: files.length } });
});

export default router;
