import { Router } from 'express';
import db from '../db/index.js';
import { PodcastService } from '../services/PodcastService.js';

const router = Router();
const podcastService = new PodcastService(db);

router.get('/', (req, res) => {
  const subs = db.prepare('SELECT * FROM podcast_subscriptions').all();
  res.json({ data: subs });
});

router.post('/subscribe', async (req, res) => {
  const { url } = req.body;
  const id = await podcastService.subscribe(url);
  res.json({ data: { id } });
});

router.get('/:id/episodes', (req, res) => {
  const episodes = db
    .prepare('SELECT * FROM podcast_episodes WHERE podcast_id = ?')
    .all(req.params.id);
  res.json({ data: episodes });
});

router.patch('/episodes/:id/progress', (req, res) => {
  const { seconds } = req.body;
  podcastService.updateProgress(req.params.id, seconds);
  res.json({ data: { success: true } });
});

export default router;
