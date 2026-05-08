import { Router } from 'express';
import db from '../db';
import { SmartPlaylistService } from '../services/SmartPlaylistService';
import crypto from 'crypto';

const router = Router();

// Get all smart playlists
router.get('/', (req, res) => {
    const playlists = db.prepare('SELECT * FROM smart_playlists ORDER BY name ASC').all();
    res.json(playlists.map((p: any) => ({
        ...p,
        definition: JSON.parse(p.definition)
    })));
});

// Create a new smart playlist
router.post('/', (req, res) => {
    const { name, definition } = req.body;
    if (!name || !definition) {
        return res.status(400).json({ error: 'Name and definition are required' });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    try {
        db.prepare(`
            INSERT INTO smart_playlists (id, name, definition, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, name, JSON.stringify(definition), now, now);

        res.status(201).json({ id, name, definition, created_at: now, updated_at: now });
    } catch (error) {
        console.error('Failed to create smart playlist:', error);
        res.status(500).json({ error: 'Failed to create smart playlist' });
    }
});

// Evaluate a smart playlist
router.get('/:id/tracks', (req, res) => {
    const playlist = db.prepare('SELECT definition FROM smart_playlists WHERE id = ?').get(req.params.id) as { definition: string } | undefined;

    if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
    }

    try {
        const definition = JSON.parse(playlist.definition);
        const tracks = SmartPlaylistService.evaluate(definition);
        res.json(tracks);
    } catch (error) {
        console.error('Failed to evaluate smart playlist:', error);
        res.status(500).json({ error: 'Failed to evaluate smart playlist' });
    }
});

// Delete a smart playlist
router.post('/preview', (req, res) => {
    const { conditions, matchMode } = req.body;
    try {
        const tracks = SmartPlaylistService.evaluate({ conditions, matchMode });
        res.json({ count: tracks.length });
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

router.delete('/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM smart_playlists WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Failed to delete smart playlist:', error);
        res.status(500).json({ error: 'Failed to delete smart playlist' });
    }
});

export default router;
