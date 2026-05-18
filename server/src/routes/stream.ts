import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import db from '../db/index.js';
import { validatePath } from '../utils/path-utils.js';

const router = Router();

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.opus': 'audio/ogg',
  '.aac': 'audio/aac',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
};

router.get('/:trackId', async (req, res) => {
  const { trackId } = req.params;
  const transcode = req.query.transcode === '1';

  const track = db.prepare('SELECT file_path, codec, owner_id, is_public FROM tracks WHERE id = ?').get(trackId) as any;

  if (!track) {
    return res.status(404).json({ error: 'Track not found' });
  }

  // Authorization check (simplified for now, will be enhanced in Task 4)
  // For local mode (127.0.0.1), skip.
  const isLocal = req.ip === '127.0.0.1' || req.ip === '::1';
  if (!isLocal && track.owner_id && !track.is_public) {
      // In a real scenario, we'd check JWT here.
      // return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!validatePath(track.file_path)) {
    return res.status(403).json({ error: 'Forbidden path' });
  }

  if (!fs.existsSync(track.file_path)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  if (transcode) {
    res.setHeader('Content-Type', 'audio/webm');
    const ffmpeg = spawn('ffmpeg', [
      '-i', track.file_path,
      '-c:a', 'libopus',
      '-b:a', '128k',
      '-f', 'webm',
      'pipe:1'
    ]);
    ffmpeg.stdout.pipe(res);
    req.on('close', () => ffmpeg.kill());
    return;
  }

  const stat = fs.statSync(track.file_path);
  const fileSize = stat.size;
  const range = req.headers.range;
  const ext = path.extname(track.file_path).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(track.file_path, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(track.file_path).pipe(res);
  }
});

router.get('/:trackId/can-play', (req, res) => {
    const { trackId } = req.params;
    const track = db.prepare('SELECT codec FROM tracks WHERE id = ?').get(trackId) as any;
    if (!track) return res.status(404).json({ error: 'Track not found' });

    // Simplified logic: browsers generally play mp3, aac, opus, vp9, h264
    const nativePlayable = ['mp3', 'aac', 'opus', 'flac', 'h264', 'vp9'].includes(track.codec?.toLowerCase());
    res.json({ nativePlayable, codec: track.codec });
});

export default router;
