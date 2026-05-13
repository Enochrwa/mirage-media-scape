import { Router } from 'express';
import db from '../db';
import { RecommendationService } from '../services/RecommendationService';

const router = Router();
const recService = new RecommendationService(db);

router.get('/tracks', (req, res) => {
  const tracks = db.prepare("SELECT * FROM tracks WHERE missing = 0").all();
  res.json({ data: tracks });
});

router.get('/tracks/:id', (req, res) => {
  const track = db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id);
  res.json({ data: track });
});

router.patch('/tracks/:id', (req, res) => {
  const { rating } = req.body;
  db.prepare("UPDATE tracks SET rating = ? WHERE id = ?").run(rating, req.params.id);
  res.json({ data: { success: true } });
});

router.get('/recommendations/:trackId', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const recs = await recService.recommend(req.params.trackId, limit);
  res.json({ data: recs });
});

router.get('/recommendations/mood', async (req, res) => {
  const energy = parseFloat(req.query.energy as string) || 0.5;
  const bpm = parseFloat(req.query.bpm as string) || 120;
  const limit = parseInt(req.query.limit as string) || 20;
  const recs = await recService.recommendByMood({ energy, bpm, limit });
  res.json({ data: recs });
});

export default router;
