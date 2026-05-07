import { Router } from 'express';
import db from '../db';

const router = Router();

router.post('/event', (req, res) => {
    const { track_id, type, timestamp, position, completed } = req.body;

    if (type === 'start') {
        const result = db.prepare(`
            INSERT INTO play_events (track_id, started_at, position)
            VALUES (?, ?, ?)
        `).run(track_id, timestamp, position || 0);
        return res.json({ id: result.lastInsertRowid });
    } else if (type === 'end') {
        const { event_id } = req.body;
        db.prepare(`
            UPDATE play_events
            SET ended_at = ?, position = ?, completed = ?
            WHERE id = ?
        `).run(timestamp, position, completed ? 1 : 0, event_id);
        return res.json({ success: true });
    }

    res.status(400).json({ error: 'Invalid event type' });
});

router.get('/top-tracks', (req, res) => {
    const tracks = db.prepare(`
        SELECT t.*, COUNT(pe.id) as play_count
        FROM tracks t
        JOIN play_events pe ON t.id = pe.track_id
        WHERE pe.completed = 1
        GROUP BY t.id
        ORDER BY play_count DESC
        LIMIT 10
    `).all();
    res.json(tracks);
});

export default router;
