import { Router } from 'express';
import db from '../db/index.js';
import { StatsService } from '../services/StatsService.js';
import { PlaybackEventService } from '../services/PlaybackEventService.js';

const router = Router();
const statsService = new StatsService(db);

type StatsPeriod = '7d' | '30d' | '90d' | 'all';

router.post('/event/start', (req, res) => {
  const { trackId, source, deviceId } = req.body;
  const eventId = PlaybackEventService.startEvent(trackId, source, deviceId);
  res.json({ data: { eventId } });
});

router.post('/event/end', (req, res) => {
  const { eventId, secondsPlayed, completed, skipped } = req.body;
  PlaybackEventService.endEvent(eventId, secondsPlayed, completed, skipped);
  res.json({ data: { success: true } });
});

/** POST /api/stats/state */
router.post('/state', (req, res) => {
  const { trackId, position, queueSnapshot, queueIndex } = req.body;
  db.prepare(`
    INSERT INTO playback_state (id, track_id, position_seconds, queue_snapshot, queue_index, timestamp)
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      track_id = excluded.track_id,
      position_seconds = excluded.position_seconds,
      queue_snapshot = excluded.queue_snapshot,
      queue_index = excluded.queue_index,
      timestamp = excluded.timestamp
  `).run(
    trackId ?? null,
    position ?? 0,
    queueSnapshot ? JSON.stringify(queueSnapshot) : null,
    queueIndex ?? 0,
    Date.now(),
  );
  res.json({ data: { success: true } });
});

/** GET /api/stats/state */
router.get('/state', (req, res) => {
  const state = db.prepare('SELECT * FROM playback_state WHERE id = 1').get();
  res.json({ data: state });
});

router.get('/top-tracks', (req, res) => {
  const { period = 'all', limit = 10 } = req.query;
  const periodValue = typeof period === 'string' && ['7d', '30d', '90d', 'all'].includes(period) ? period as StatsPeriod : 'all';
  const tracks = statsService.getTopTracks(periodValue, Number(limit));
  res.json({ data: tracks });
});

router.get('/top-artists', (req, res) => {
  const { period = 'all', limit = 10 } = req.query;
  const periodValue = typeof period === 'string' && ['7d', '30d', '90d', 'all'].includes(period) ? period as StatsPeriod : 'all';
  const artists = statsService.getTopArtists(periodValue, Number(limit));
  res.json({ data: artists });
});

router.get('/heatmap', (req, res) => {
   res.json({ data: statsService.getHeatmap() });
 });

 router.get('/history', (req, res) => {
   const history = db
     .prepare(
       `SELECT pe.id, pe.started_at, pe.seconds_played, pe.completed, pe.skipped,
               t.id as track_id, t.title, t.artist, t.cover_cache_path, t.file_path
        FROM play_events pe
        JOIN tracks t ON pe.track_id = t.id
        ORDER BY pe.started_at DESC
        LIMIT 50`
     )
     .all();
   res.json({ data: history });
 });

 router.get('/summary', (req, res) => {
   const totalPlays = db.prepare('SELECT COUNT(*) as count FROM play_events WHERE completed = 1').get() as { count: number };
   const totalTime = statsService.getTotalTime();
   const topArtist = db
     .prepare(
       `SELECT t.artist, SUM(pe.seconds_played) as total_time
        FROM play_events pe
        JOIN tracks t ON pe.track_id = t.id
        WHERE pe.completed = 1
        GROUP BY t.artist
        ORDER BY total_time DESC
        LIMIT 1`
     )
     .get() as { artist: string } | undefined;
   res.json({ data: { totalPlays: totalPlays.count, totalTimeSeconds: totalTime, topArtist: topArtist?.artist ?? null } });
 });

router.get('/recap/:year', (req, res) => {
   res.json({ data: statsService.getYearRecap(Number(req.params.year)) });
 });

 router.get('/artist/:name/history', (req, res) => {
   const name = req.params.name;
   const history = db
     .prepare(
       `SELECT strftime('%Y-%m', pe.started_at) as month,
               SUM(pe.seconds_played) as minutes
        FROM play_events pe
        JOIN tracks t ON pe.track_id = t.id
        WHERE pe.completed = 1 AND t.artist = ?
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12`,
     )
     .all(name);
   res.json({ data: history });
 });

 export default router;
