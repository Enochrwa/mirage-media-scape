import { Request, Response } from 'express';
import os from 'os';
import db from '../db/index.js';
import { scannerService } from '../services/scanner.js';
import { refreshLibraryWatcherPaths } from '../services/LibraryWatcher.js';

export const scanFolder = async (req: Request, res: Response) => {
  const { directory } = req.body;
  if (!directory) {
    scannerService.scanAll();
    refreshLibraryWatcherPaths();
    return res.json({ message: 'Global scan started' });
  }

  await scannerService.addFolder(directory);
  refreshLibraryWatcherPaths();
  res.json({ message: 'Folder added and scan started' });
};

export const getBootstrap = (_req: Request, res: Response) => {
  const folderCount = (
    db.prepare('SELECT COUNT(*) as c FROM watched_folders').get() as { c: number }
  ).c;
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'library_onboarding_complete'")
    .get() as { value: string } | undefined;
  let onboardingComplete = row?.value === '1';
  if (folderCount > 0 && !onboardingComplete) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'library_onboarding_complete',
      '1',
    );
    onboardingComplete = true;
  }
  res.json({ folderCount, onboardingComplete });
};

export const postOnboardingHome = async (_req: Request, res: Response) => {
  const home = os.homedir();
  db.prepare(
    'INSERT OR IGNORE INTO watched_folders (path, added_at, auto_discovered) VALUES (?, ?, 1)',
  ).run(home, Date.now());
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    'library_onboarding_complete',
    '1',
  );
  await scannerService.scan([home]);
  refreshLibraryWatcherPaths();
  res.json({ ok: true, path: home });
};

export const postOnboardingChooseFolder = async (req: Request, res: Response) => {
  const { directory } = req.body;
  if (!directory || typeof directory !== 'string') {
    return res.status(400).json({ error: 'directory is required' });
  }
  const trimmed = directory.trim();
  db.prepare(
    'INSERT OR IGNORE INTO watched_folders (path, added_at, auto_discovered) VALUES (?, ?, 0)',
  ).run(trimmed, Date.now());
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    'library_onboarding_complete',
    '1',
  );
  await scannerService.scan([trimmed]);
  refreshLibraryWatcherPaths();
  res.json({ ok: true, path: trimmed });
};

export const postOnboardingDismiss = (_req: Request, res: Response) => {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    'library_onboarding_complete',
    '1',
  );
  res.json({ ok: true });
};
