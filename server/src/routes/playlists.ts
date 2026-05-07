import { Router } from 'express';
import db from '../db';
import { SmartPlaylistService } from '../services/SmartPlaylistService';
import crypto from 'crypto';

const router = Router();

// Get all smart playlists
router.get('/', (req, res) => {
    const playlists = db.prepare('SELECT * FROM smart_playlists ORDER BY name ASC').all();
    res.json(playlists);
});

// Create a new smart playlist
router.post('/', (req, res) => {
    const { name, rules } = req.body;
    if (!name || !rules) {
        return res.status(400).json({ error: 'Name and rules are required' });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    try {
        db.prepare(`
            INSERT INTO smart_playlists (id, name, rules_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, name, JSON.stringify(rules), now, now);

        res.status(201).json({ id, name, rules, created_at: now, updated_at: now });
    } catch (error) {
        console.error('Failed to create smart playlist:', error);
        res.status(500).json({ error: 'Failed to create smart playlist' });
    }
});

// Evaluate a smart playlist
router.get('/:id/tracks', (req, res) => {
    const playlist = db.prepare('SELECT rules_json FROM smart_playlists WHERE id = ?').get(req.params.id) as { rules_json: string } | undefined;

    if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
    }

    try {
        const rules = JSON.parse(playlist.rules_json);
        const tracks = SmartPlaylistService.evaluate(rules);
        res.json(tracks);
    } catch (error) {
        console.error('Failed to evaluate smart playlist:', error);
        res.status(500).json({ error: 'Failed to evaluate smart playlist' });
    }
});

// Delete a smart playlist
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
