import { Router } from 'express';
import db from '../db';
import { StatsService } from '../services/StatsService';

const router = Router();

router.post('/event', (req, res) => {
  const { track_id, type, timestamp, position, completed } = req.body;

  if (type === 'start') {
    const result = db
      .prepare(
        `
            INSERT INTO play_events (track_id, started_at, position)
            VALUES (?, ?, ?)
        `,
      )
      .run(track_id, timestamp, position || 0);
    return res.json({ id: result.lastInsertRowid });
  } else if (type === 'end') {
    const { event_id } = req.body;
    db.prepare(
      `
            UPDATE play_events
            SET ended_at = ?, position = ?, completed = ?
            WHERE id = ?
        `,
    ).run(timestamp, position, completed ? 1 : 0, event_id);
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'Invalid event type' });
});

router.get('/top-tracks', (req, res) => {
  const tracks = StatsService.getTopTracks(parseInt(req.query.limit as string) || 10);
  res.json(tracks);
});

router.get('/history', (req, res) => {
  const history = StatsService.getHistory(parseInt(req.query.limit as string) || 50);
  res.json(history);
});

router.get('/summary', (req, res) => {
  const summary = StatsService.getStats();
  res.json(summary);
});

export default router;
