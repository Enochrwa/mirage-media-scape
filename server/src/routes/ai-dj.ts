import { Router } from 'express';
import { AIDJService } from '../services/AIDJService';

const router = Router();
import db from '../db';
const djService = new AIDJService(db);

router.post('/generate-intro', (req, res) => {
  const { prevTrack, nextTrack } = req.body;
  const intro = djService.generateScript(prevTrack, nextTrack);
  res.json({ data: { intro } });
});

export default router;
