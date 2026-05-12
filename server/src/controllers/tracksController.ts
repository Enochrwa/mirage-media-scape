import { Request, Response } from 'express';
import db from '../db';
import path from 'path';
import fs from 'fs';
import { Worker } from 'worker_threads';
import { RecommendationService } from '../services/RecommendationService';
import { FingerprintService } from '../services/FingerprintService';
import { DuplicateFinderService } from '../services/DuplicateFinderService';

export const getInstantTracks = (_req: Request, res: Response) => {
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

export const getAllTracks = (req: Request, res: Response) => {
  const tracks = db.prepare('SELECT * FROM tracks WHERE missing = 0 ORDER BY added_at DESC').all();
  res.json(tracks);
};

export const streamTrack = (req: Request, res: Response) => {
  const { path: filePath } = req.query;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).send('Path is required');
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/mpeg',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'audio/mpeg',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
};

export const searchTracks = (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const results = db
      .prepare(
        `
            SELECT t.*, bm25(tracks_fts) as rank
            FROM tracks_fts f
            JOIN tracks t ON t.id = f.id
            WHERE tracks_fts MATCH ?
            ORDER BY rank
            LIMIT 50
        `,
      )
      .all(`${q}*`);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

export const getRecommendations = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const recommendationService = new RecommendationService(db);
    const recommendations = await recommendationService.recommend(id);
    res.json(recommendations);
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
};

export const identifyTrack = async (req: Request, res: Response) => {
  const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(req.params.id) as
    | { file_path: string }
    | undefined;
  if (!track) return res.status(404).json({ error: 'Track not found' });

  try {
    const metadata = await FingerprintService.identifyTrack(track.file_path);
    if (!metadata) return res.status(404).json({ error: 'Could not identify track' });
    res.json(metadata);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

export const getDuplicateCandidates = async (req: Request, res: Response) => {
  try {
    const duplicateFinder = new DuplicateFinderService(db);
    const groups = await duplicateFinder.findDuplicates();
    res.json(groups);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

export const getTrackCover = (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const row = db.prepare('SELECT cover_cache_path FROM tracks WHERE id = ?').get(id) as
    | { cover_cache_path?: string }
    | undefined;
  if (!row?.cover_cache_path) {
    return res.status(404).end();
  }
  if (!fs.existsSync(row.cover_cache_path)) {
    return res.status(404).end();
  }
  res.sendFile(path.resolve(row.cover_cache_path));
};

export const getTrackThumbnail = (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const row = db.prepare('SELECT thumbnail_path FROM tracks WHERE id = ?').get(id) as
    | { thumbnail_path?: string }
    | undefined;
  if (!row?.thumbnail_path) {
    return res.status(404).end();
  }
  if (!fs.existsSync(row.thumbnail_path)) {
    return res.status(404).end();
  }
  res.sendFile(path.resolve(row.thumbnail_path));
};

export const getTrackById = (req: Request, res: Response) => {
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) {
    return res.status(404).json({ error: 'Track not found' });
  }
  res.json(track);
};

export const getTrackWaveform = (req: Request, res: Response) => {
  const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(req.params.id) as
    | { file_path: string }
    | undefined;

  if (!track) {
    return res.status(404).json({ error: 'Track not found' });
  }

  const worker = new Worker(path.resolve(__dirname, '../routes/waveform-worker.js'), {
    workerData: { filePath: track.file_path },
  });

  worker.on('message', (data) => {
    if (data.error) {
      res.status(500).json({ error: data.error });
    } else {
      res.json({ peaks: data.peaks });
    }
  });

  worker.on('error', (error) => {
    console.error('Worker error:', error);
    res.status(500).json({ error: 'Internal worker error' });
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Worker stopped with exit code ${code}`);
    }
  });
};
