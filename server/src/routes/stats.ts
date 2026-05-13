import { Router } from 'express';
import db from '../db';
import { StatsService } from '../services/StatsService';
import { PlaybackEventService } from '../services/PlaybackEventService';

const router = Router();
const statsService = new StatsService(db);

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
  const tracks = statsService.getTopTracks(period as any, Number(limit));
  res.json({ data: tracks });
});

router.get('/top-artists', (req, res) => {
  const { period = 'all', limit = 10 } = req.query;
  const artists = statsService.getTopArtists(period as any, Number(limit));
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
