import { Request, Response } from 'express';
import db from '../db';
import { SmartPlaylistService, type SmartPlaylistRules } from '../services/SmartPlaylistService';
import crypto from 'crypto';

interface SmartPlaylistRow {
    id: string;
    name: string;
    definition: string;
    created_at: number;
    updated_at: number;
}

export const getAllSmartPlaylists = (req: Request, res: Response) => {
    const playlists = db.prepare('SELECT * FROM smart_playlists ORDER BY name ASC').all() as SmartPlaylistRow[];
    res.json(
        playlists.map((p) => ({
            ...p,
            definition: JSON.parse(p.definition) as SmartPlaylistRules,
        })),
    );
};

export const createSmartPlaylist = (req: Request, res: Response) => {
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
};

export const getSmartPlaylistTracks = (req: Request, res: Response) => {
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
};

export const previewSmartPlaylist = (req: Request, res: Response) => {
    const { conditions, matchMode } = req.body;
    try {
        const tracks = SmartPlaylistService.evaluate({ conditions, matchMode });
        res.json({ count: tracks.length });
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
};

export const deleteSmartPlaylist = (req: Request, res: Response) => {
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
};
