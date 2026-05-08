import { Router } from 'express';
import db from '../db';
import path from 'path';
import fs from 'fs';
import { Worker } from 'worker_threads';
import { RecommendationService } from '../services/RecommendationService';

const router = Router();

router.get('/', (req, res) => {
    const tracks = db.prepare('SELECT * FROM tracks WHERE missing = 0 ORDER BY added_at DESC').all();
    res.json(tracks);
});

router.get('/stream', (req, res) => {
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
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg', // Should ideally be dynamic
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
});

router.get('/search', (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
    }

    try {
        const results = db.prepare(`
            SELECT t.*, bm25(tracks_fts) as rank
            FROM tracks_fts f
            JOIN tracks t ON t.id = f.id
            WHERE tracks_fts MATCH ?
            ORDER BY rank
            LIMIT 50
        `).all(`${q}*`);
        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

router.get('/:id/recommendations', (req, res) => {
    try {
        const recommendations = RecommendationService.findSimilar(req.params.id);
        res.json(recommendations);
    } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

router.get('/:id', (req, res) => {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
    if (!track) {
        return res.status(404).json({ error: 'Track not found' });
    }
    res.json(track);
});

router.get('/:id/waveform', (req, res) => {
    const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(req.params.id) as { file_path: string } | undefined;

    if (!track) {
        return res.status(404).json({ error: 'Track not found' });
    }

    const worker = new Worker(path.resolve(__dirname, './waveform-worker.js'), {
        workerData: { filePath: track.file_path }
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
});

export default router;
