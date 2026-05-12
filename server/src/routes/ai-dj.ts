import { Router } from 'express';
import { AIDJService } from '../services/AIDJService';

const router = Router();
const djService = new AIDJService();

router.post('/generate-intro', (req, res) => {
  const { prevTrack, nextTrack } = req.body;
  const intro = djService.generateIntro(prevTrack, nextTrack);
  res.json({ intro });
});

export default router;
