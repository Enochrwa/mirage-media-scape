import { Router } from 'express';
import db from '../db';
import { PodcastService } from '../services/PodcastService';

const router = Router();
const podcastService = new PodcastService(db);

router.post('/subscribe', async (req, res) => {
  const { url } = req.body;
  try {
    const id = await podcastService.subscribe(url);
    res.json({ id });
  } catch (_e) {
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

router.get('/subscriptions', async (req, res) => {
  const subs = await podcastService.getSubscriptions();
  res.json(subs);
});

router.get('/:id/episodes', async (req, res) => {
  const episodes = await podcastService.getEpisodes(req.params.id);
  res.json(episodes);
});

export default router;
