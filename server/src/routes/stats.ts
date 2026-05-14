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

router.get('/total-time', (req, res) => {
  res.json({ data: { totalSeconds: statsService.getTotalTime() } });
});

router.get('/recap/:year', (req, res) => {
  res.json({ data: statsService.getYearRecap(Number(req.params.year)) });
});

export default router;
