import { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import db from '../db/index.js';
import native from '../utils/native-loader.js';

const router = Router();

// Resolve uploads directory relative to this file so it works regardless
// of the working directory when the server is started.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Go up to server root: dist/src/routes → server root  OR  src/routes → server root
const SERVER_ROOT = path.resolve(__dirname, '..', '..', '..').endsWith('dist')
  ? path.resolve(__dirname, '..', '..', '..', '..')
  : path.resolve(__dirname, '..', '..');
const UPLOADS_ROOT = path.join(SERVER_ROOT, 'uploads');

const storage = multer.diskStorage({
  destination: (req: AuthRequest, _file, cb) => {
    const userId = req.user?.id ?? 'anonymous';
    const safeUserId = userId.replace(/[^a-z0-9_-]/gi, '');
    const now = new Date();
    const dir = path.join(
      UPLOADS_ROOT,
      safeUserId,
      now.getFullYear().toString(),
      (now.getMonth() + 1).toString(),
    );
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safeName = path.basename(file.originalname).replace(/[^a-z0-9._-]/gi, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 900 * 1024 * 1024 }
});

const uploadCounts = new Map<string, number>();

router.post('/', authMiddleware, upload.single('file'), async (req: Request, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const userId = (req as AuthRequest).user!.id;
  const count = uploadCounts.get(userId) || 0;
  if (count >= 5) return res.status(429).json({ error: 'Too many concurrent uploads' });
  uploadCounts.set(userId, count + 1);

  try {
    // Security: Ensure we only use the base filename provided by Multer
    const safeFilename = path.basename(req.file.filename);
    const destinationDir = path.resolve(req.file.destination);
    const filePath = path.join(destinationDir, safeFilename);

    // Security: validate that the file is within the uploads directory
    const relative = path.relative(UPLOADS_ROOT, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      // Avoid calling unlink on potentially malicious paths; let OS/disk quota handle it
      return res.status(403).json({ error: 'Forbidden' });
    }

    const stats = fs.statSync(filePath);

    // Disk quota check (10 GB)
    const userStorage = db.prepare('SELECT SUM(file_size) as total FROM tracks WHERE owner_id = ?').get(userId) as { total: number | null } | undefined;
    if ((userStorage?.total || 0) + stats.size > 10 * 1024 * 1024 * 1024) {
        fs.unlinkSync(filePath);
        return res.status(413).json({ error: 'Disk quota exceeded' });
    }

    const metadata = native.extractMetadata(filePath);
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO tracks (
        id, file_path, file_type, title, artist, album, duration, codec,
        bitrate, sample_rate, file_size, owner_id, is_public, upload_path, added_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, filePath, metadata.fileType, metadata.title || req.file.originalname,
      metadata.artist, metadata.album, metadata.duration, metadata.codecName,
      metadata.bitRate, metadata.sampleRate, stats.size, userId,
      req.body.isPublic === 'true' ? 1 : 0, filePath, Date.now()
    );

    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id);

    // Async waveform generation
    setImmediate(() => {
        try { native.generateWaveform(filePath); } catch(_e) { console.error(_e); }
    });

    res.json({ track });
  } catch (err: unknown) {
    console.error('Upload processing failed', err);
    res.status(500).json({ error: 'Failed to process upload' });
  } finally {
    uploadCounts.set(userId, (uploadCounts.get(userId) || 1) - 1);
  }
});

router.delete('/:trackId', authMiddleware, (req: AuthRequest, res) => {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.trackId) as { owner_id: string, upload_path: string | null } | undefined;
    if (!track) return res.status(404).json({ error: 'Track not found' });
    if (track.owner_id !== req.user?.id && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    if (track.upload_path && fs.existsSync(track.upload_path)) {
        fs.unlinkSync(track.upload_path);
    }
    db.prepare('DELETE FROM tracks WHERE id = ?').run(req.params.trackId);
    res.json({ success: true });
});

export default router;