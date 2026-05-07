import { Router } from 'express';
import db from '../db';
import path from 'path';
import { Worker } from 'worker_threads';

const router = Router();

router.get('/', (req, res) => {
    const tracks = db.prepare('SELECT * FROM tracks ORDER BY added_at DESC').all();
    res.json(tracks);
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
