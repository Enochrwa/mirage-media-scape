import { Request, Response } from 'express';
import db from '../db/index.js';
import path from 'path';
import fs from 'fs';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { RecommendationService } from '../services/RecommendationService.js';
import { FingerprintService } from '../services/FingerprintService.js';
import { DuplicateFinderService } from '../services/DuplicateFinderService.js';
import { analysisService } from '../services/AnalysisService.js';

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Library queries
// ─────────────────────────────────────────────────────────────────────────────

export const getInstantTracks = (_req: Request, res: Response): void => {
  const rows = db
    .prepare(
      `SELECT id, title, artist, album, duration, cover_cache_path,
              thumbnail_path, file_path, file_type, bpm, camelot_key,
              rating, play_count, missing
       FROM tracks
       WHERE missing = 0
       ORDER BY added_at DESC
       LIMIT 500`,
    )
    .all();
  res.json(rows);
};

export const getAllTracks = (_req: Request, res: Response): void => {
  const tracks = db.prepare('SELECT * FROM tracks WHERE missing = 0 ORDER BY added_at DESC').all();
  res.json(tracks);
};

// ─────────────────────────────────────────────────────────────────────────────
// Streaming
// ─────────────────────────────────────────────────────────────────────────────

export const streamTrack = (req: Request, res: Response): void => {
  const { path: filePath } = req.query;
  if (!filePath || typeof filePath !== 'string') {
    res.status(400).send('Path is required');
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).send('File not found');
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(filePath).toLowerCase();
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
  const contentType = mimeMap[ext] ?? 'application/octet-stream';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
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
    fs.createReadStream(filePath).pipe(res);
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
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const recommendationService = new RecommendationService(db);
    const recommendations = await recommendationService.recommend(id, limit);
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
  const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(req.params.id) as
    | { file_path: string }
    | undefined;

  if (!track) {
    res.status(404).json({ error: 'Track not found' });
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
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const row = db.prepare('SELECT cover_cache_path FROM tracks WHERE id = ?').get(id) as
    | { cover_cache_path?: string }
    | undefined;

  if (!row?.cover_cache_path || !fs.existsSync(row.cover_cache_path)) {
    res.status(404).end();
    return;
  }
  res.sendFile(path.resolve(row.cover_cache_path));
};

export const getTrackThumbnail = (req: Request, res: Response): void => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const row = db.prepare('SELECT thumbnail_path FROM tracks WHERE id = ?').get(id) as
    | { thumbnail_path?: string }
    | undefined;

  if (!row?.thumbnail_path || !fs.existsSync(row.thumbnail_path)) {
    res.status(404).end();
    return;
  }
  res.sendFile(path.resolve(row.thumbnail_path));
};

// ─────────────────────────────────────────────────────────────────────────────
// Individual track / album
// ─────────────────────────────────────────────────────────────────────────────

export const getTrackById = (req: Request, res: Response): void => {
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
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
  const { id } = req.params;
  const { rating } = req.body as { rating: unknown };

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 0 || ratingNum > 5) {
    res.status(400).json({ error: 'Rating must be an integer between 0 and 5' });
    return;
  }

  try {
    const result = db.prepare('UPDATE tracks SET rating = ? WHERE id = ?').run(ratingNum, id);
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
  const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(req.params.id) as
    | { file_path: string }
    | undefined;

  if (!track) {
    res.status(404).json({ error: 'Track not found' });
    return;
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

export const updateTrackMetadata = (req: Request, res: Response): void => {
  const { id } = req.params;
  const { title, artist, album, bpm, key, camelot_key } = req.body;

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
          updated_at = ?
         WHERE id = ?`,
      )
      .run(title, artist, album, bpm, key, camelot_key, Date.now(), id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Track not found' });
      return;
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

export const reanalyzeTrack = async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const analysis = await analysisService.analyzeSingleTrack(id);
    if (!analysis) {
      res.status(404).json({ error: 'Track not found' });
      return;
    }
    res.json(analysis);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};
