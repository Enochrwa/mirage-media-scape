import { Request, Response } from 'express';
import db from '../db/index.js';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { spawn } from 'child_process';
import native from '../utils/native-loader.js';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { RecommendationService } from '../services/RecommendationService.js';
import { FingerprintService } from '../services/FingerprintService.js';
import { DuplicateFinderService } from '../services/DuplicateFinderService.js';
import { analysisService } from '../services/AnalysisService.js';
import { LyricsService } from '../services/LyricsService.js';
import { sanitizeId, validatePath } from '../utils/path-utils.js';

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to extract string ID from params
const getParamId = (req: Request): string => {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : (id as string);
};

// ─────────────────────────────────────────────────────────────────────────────
// Library queries
// ─────────────────────────────────────────────────────────────────────────────

export const getInstantTracks = (req: Request, res: Response): void => {
  const limit = parseInt(req.query.limit as string) || 500;
  const offset = parseInt(req.query.offset as string) || 0;

  const rows = db
    .prepare(
      `SELECT id, title, artist, album, duration, cover_cache_path,
              thumbnail_path, file_path, file_type, bpm, camelot_key,
              rating, play_count, missing
       FROM tracks
       WHERE missing = 0
       ORDER BY added_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset);
  res.json(rows);
};

export const getAllTracks = (req: Request, res: Response): void => {
  const limit = parseInt(req.query.limit as string) || 2000; // Safer default for low-RAM devices
  const offset = parseInt(req.query.offset as string) || 0;

  const tracks = db
    .prepare('SELECT * FROM tracks WHERE missing = 0 ORDER BY added_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
  res.json(tracks);
};

// ─────────────────────────────────────────────────────────────────────────────
// Streaming
// ─────────────────────────────────────────────────────────────────────────────

export const streamTrack = (req: Request, res: Response): void => {
  const { id, audio_stream } = req.query;

  if (!id || typeof id !== 'string') {
    res.status(400).send('Track ID is required');
    return;
  }

  const safeId = sanitizeId(id);
  const track = db.prepare('SELECT file_path, upload_path FROM tracks WHERE id = ?').get(safeId) as
    | { file_path: string; upload_path: string | null }
    | undefined;

  if (!track || !track.file_path) {
    res.status(404).send('Track not found');
    return;
  }

  // If this is an uploaded track (upload_path is set and equals file_path), skip library validation.
  // Otherwise, validate that the path is still valid and within library bounds.
  if (!(track.upload_path && track.upload_path === track.file_path)) {
    const filePath = track.file_path;
    if (!validatePath(filePath)) {
      res.status(403).send('Access denied to library file');
      return;
    }
  }


  // Handle remuxing if specific audio stream requested
  if (audio_stream !== undefined) {
    const streamIndex = parseInt(audio_stream as string, 10);
    if (isNaN(streamIndex) || streamIndex < 0) {
      res.status(400).send('Invalid audio stream index');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'video/x-matroska',
      'Transfer-Encoding': 'chunked',
    });

    const ffmpeg = spawn('ffmpeg', [
      '-i',
      track.file_path,

      '-map',
      '0:v:0',
      '-map',
      `0:a:${streamIndex}`,
      '-c',
      'copy',
      '-f',
      'matroska',
      'pipe:1',
    ]);

    ffmpeg.stdout.pipe(res);
    ffmpeg.stderr.on('data', () => {});

    req.on('close', () => ffmpeg.kill());
    return;
  }

  const stat = fs.statSync(track.file_path);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(track.file_path).toLowerCase();

  const mimeMap: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/ogg; codecs=opus',
    '.wma': 'audio/x-ms-wma',
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
  };

  const isVideo = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.wmv', '.mpeg', '.mpg'].includes(ext);

  // Frontend uses /api/stream/:id for both audio & video.
  // Raw byte streaming for many uploaded video containers/codecs can fail in browsers.
  // Default to transcoding unless explicitly disabled.
  const transcodeDisabled = String(req.query.transcode).toLowerCase() === '0';
  const shouldTranscode = isVideo && !transcodeDisabled;

  const contentType = mimeMap[ext] ?? 'application/octet-stream';

  if (shouldTranscode) {
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'no-store');

    const ffmpeg = spawn('ffmpeg', [
      '-i', track.file_path,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1',
    ]);

    ffmpeg.stdout.pipe(res);
    ffmpeg.stderr.on('data', () => {});

    req.on('close', () => ffmpeg.kill('SIGKILL'));
    return;
  }


  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || isNaN(end) || start < 0 || end < 0 || start > end || start >= fileSize) {
      res.status(416).send('Requested Range Not Satisfiable');
      return;
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(track.file_path, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(track.file_path).pipe(res);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

export const searchTracks = (req: Request, res: Response): void => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') {
    res.status(400).json({ error: 'Search query is required' });
    return;
  }

  try {
    const results = db
      .prepare(
        `SELECT t.*, bm25(tracks_fts) as rank
         FROM tracks_fts f
         JOIN tracks t ON t.id = f.id
         WHERE tracks_fts MATCH ?
         ORDER BY rank
         LIMIT 50`,
      )
      .all(`${q}*`);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Recommendations
// ─────────────────────────────────────────────────────────────────────────────

export const getRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const safeId = sanitizeId(id);
    const limitQuery = req.query.limit;
    const limit = parseInt(typeof limitQuery === 'string' ? limitQuery : '20', 10) || 20;
    const recommendationService = new RecommendationService(db);
    const recommendations = await recommendationService.recommend(safeId, limit);
    res.json(recommendations);
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Fingerprint / identify
// ─────────────────────────────────────────────────────────────────────────────

export const identifyTrack = async (req: Request, res: Response): Promise<void> => {
  const safeId = sanitizeId(getParamId(req));
  const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(safeId) as
    | { file_path: string }
    | undefined;

  if (!track || !track.file_path) {
    res.status(404).json({ error: 'Track not found' });
    return;
  }

  if (!validatePath(track.file_path)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  try {
    const metadata = await FingerprintService.identifyTrack(track.file_path, db);
    if (!metadata) {
      res.status(404).json({ error: 'Could not identify track' });
      return;
    }
    res.json(metadata);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Duplicates
// ─────────────────────────────────────────────────────────────────────────────

export const getDuplicateCandidates = async (_req: Request, res: Response): Promise<void> => {
  try {
    const duplicateFinder = new DuplicateFinderService(db);
    const groups = await duplicateFinder.findDuplicates();
    res.json(groups);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Cover / thumbnail
// ─────────────────────────────────────────────────────────────────────────────

export const getTrackCover = (req: Request, res: Response): void => {
  const safeId = sanitizeId(getParamId(req));
  const row = db.prepare('SELECT cover_cache_path FROM tracks WHERE id = ?').get(safeId) as
    | { cover_cache_path?: string }
    | undefined;

  if (!row?.cover_cache_path) {
    res.status(404).end();
    return;
  }

  const absolutePath = path.resolve(row.cover_cache_path);
  // Optional: Check if absolutePath is inside a cache directory
  res.sendFile(absolutePath);
};

export const getTrackThumbnail = (req: Request, res: Response): void => {
  const safeId = sanitizeId(getParamId(req));
  const row = db.prepare('SELECT thumbnail_path FROM tracks WHERE id = ?').get(safeId) as
    | { thumbnail_path?: string }
    | undefined;

  if (!row?.thumbnail_path) {
    res.status(404).end();
    return;
  }

  const absolutePath = path.resolve(row.thumbnail_path);
  res.sendFile(absolutePath);
};

const thumbAtCache = new Map<string, Buffer>();
const MAX_THUMB_CACHE = 100;

export const getTrackThumbnailAt = (req: Request, res: Response): void => {
  const safeId = sanitizeId(getParamId(req));
  const atValue = req.query.at;
  const atRaw = parseFloat(typeof atValue === 'string' ? atValue : '0');
  const at = Math.floor(isNaN(atRaw) ? 0 : Math.abs(atRaw));

  const row = db
    .prepare('SELECT file_path, last_modified, file_size FROM tracks WHERE id = ?')
    .get(safeId) as { file_path: string; last_modified: number; file_size: number } | undefined;

  if (!row || !row.file_path) {
    res.status(404).send('Track not found');
    return;
  }

  if (!validatePath(row.file_path)) {
    res.status(403).send('Access denied');
    return;
  }

  const cacheKey = `${safeId}_${at}_${row.last_modified}_${row.file_size}`;
  if (thumbAtCache.has(cacheKey)) {
    res.set('Content-Type', 'image/jpeg');
    res.send(thumbAtCache.get(cacheKey));
    return;
  }

  const pathHash = crypto.createHash('md5').update(row.file_path).digest('hex');
  const tempThumbPath = path.join(os.tmpdir(), `thumb_${pathHash}_${at}.jpg`);
  const absoluteTempPath = path.resolve(tempThumbPath);

  try {
    native.generateThumbnail(row.file_path, at, absoluteTempPath);
    const buffer = fs.readFileSync(absoluteTempPath);

    if (thumbAtCache.size >= MAX_THUMB_CACHE) {
      const firstKey = thumbAtCache.keys().next().value;
      if (firstKey) thumbAtCache.delete(firstKey);
    }
    thumbAtCache.set(cacheKey, buffer);

    res.set('Content-Type', 'image/jpeg');
    res.send(buffer);

    if (fs.existsSync(absoluteTempPath)) {
      fs.unlinkSync(absoluteTempPath);
    }
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

export const reanalyzeTrack = async (req: Request, res: Response): Promise<void> => {
  const safeId = sanitizeId(getParamId(req));
  try {
    const analysis = await analysisService.analyzeSingleTrack(safeId);
    if (!analysis) {
      res.status(404).json({ error: 'Track not found' });
      return;
    }
    res.json(analysis);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

export const getTrackAudioStreams = (req: Request, res: Response): void => {
  const safeId = sanitizeId(getParamId(req));
  try {
    const streams = db.prepare('SELECT * FROM track_audio_streams WHERE track_id = ?').all(safeId);
    res.json(streams);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

export const getTrackChapters = (req: Request, res: Response): void => {
  const safeId = sanitizeId(getParamId(req));
  try {
    const chapters = db
      .prepare('SELECT * FROM track_chapters WHERE track_id = ? ORDER BY chapter_index ASC')
      .all(safeId);
    res.json(chapters);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Individual track / album
// ─────────────────────────────────────────────────────────────────────────────

export const getTrackById = (req: Request, res: Response): void => {
  const safeId = sanitizeId(getParamId(req));
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(safeId);
  if (!track) {
    res.status(404).json({ error: 'Track not found' });
    return;
  }
  res.json(track);
};

export const getAlbumDetails = (req: Request, res: Response): void => {
  const { id } = req.params;
  try {
    const album = db
      .prepare(
        `SELECT album as name, artist, year, cover_cache_path as cover
         FROM tracks
         WHERE album = ?
         LIMIT 1`,
      )
      .get(id);
    if (!album) {
      res.status(404).json({ error: 'Album not found' });
      return;
    }
    const tracks = db
      .prepare(
        `SELECT * FROM tracks
         WHERE album = ?
         ORDER BY disc_number ASC, track_number ASC`,
      )
      .all(id);
    res.json({ album, tracks });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

export const updateTrackRating = (req: Request, res: Response): void => {
  const safeId = sanitizeId(getParamId(req));
  const { rating } = req.body as { rating: unknown };

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 0 || ratingNum > 5) {
    res.status(400).json({ error: 'Rating must be an integer between 0 and 5' });
    return;
  }

  try {
    const result = db.prepare('UPDATE tracks SET rating = ? WHERE id = ?').run(ratingNum, safeId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Track not found' });
      return;
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Waveform (Worker thread)
// ─────────────────────────────────────────────────────────────────────────────

export const getTrackWaveform = (req: Request, res: Response): void => {
  const safeId = sanitizeId(getParamId(req));
  const track = db.prepare('SELECT file_path, upload_path FROM tracks WHERE id = ?').get(safeId) as
    | { file_path: string; upload_path: string | null }
    | undefined;

  if (!track || !track.file_path) {
    res.status(404).json({ error: 'Track not found' });
    return;
  }

  // If this is an uploaded track (upload_path is set and equals file_path), skip library validation.
  // Otherwise, validate that the path is still valid and within library bounds.
  if (!(track.upload_path && track.upload_path === track.file_path)) {
    if (!validatePath(track.file_path)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
  }

  // In compiled output the tree is:
  //   dist/src/controllers/tracksController.js  ← __dirname
  //   dist/src/routes/waveform-worker.js        ← target
  const workerPath = path.resolve(__dirname, '../routes/waveform-worker.js');

  const worker = new Worker(workerPath, {
    workerData: { filePath: track.file_path, dbPath: db.name },
  });

  worker.once('message', (data: { peaks?: number[]; error?: string }) => {
    if (data.error) {
      res.status(500).json({ error: data.error });
    } else {
      res.json({ peaks: data.peaks ?? [] });
    }
  });

  worker.once('error', (error) => {
    console.error('Waveform worker error:', error);
    res.status(500).json({ error: 'Internal worker error' });
  });

  worker.once('exit', (code) => {
    if (code !== 0) {
      console.error(`Waveform worker exited with code ${code}`);
    }
  });
};

import { Track } from '../types/database.js';

export const getTrackLyrics = async (req: Request, res: Response): Promise<void> => {
  const safeId = sanitizeId(getParamId(req));
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(safeId) as Track | undefined;

  if (!track) {
    res.status(404).json({ error: 'Track not found' });
    return;
  }

  try {
    const lyricsService = new LyricsService(db);
    const lyrics = await lyricsService.getLyrics(track);
    res.json(lyrics);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

export const updateTrackMetadata = (req: Request, res: Response): void => {
  const safeId = sanitizeId(getParamId(req));
  const {
    title,
    artist,
    album,
    bpm,
    key,
    camelot_key,
    aspect_ratio_override,
    rotation_degrees,
    mirror_flip,
  } = req.body;

  try {
    const result = db
      .prepare(
        `UPDATE tracks SET
          title = COALESCE(?, title),
          artist = COALESCE(?, artist),
          album = COALESCE(?, album),
          bpm = COALESCE(?, bpm),
          key = COALESCE(?, key),
          camelot_key = COALESCE(?, camelot_key),
          aspect_ratio_override = COALESCE(?, aspect_ratio_override),
          rotation_degrees = COALESCE(?, rotation_degrees),
          mirror_flip = COALESCE(?, mirror_flip),
          updated_at = ?
         WHERE id = ?`,
      )
      .run(
        title,
        artist,
        album,
        bpm,
        key,
        camelot_key,
        aspect_ratio_override,
        rotation_degrees,
        mirror_flip,
        Date.now(),
        safeId,
      );

    if (result.changes === 0) {
      res.status(404).json({ error: 'Track not found' });
      return;
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};
