import { Router } from 'express';
import { SubtitleService, type SubtitleCue } from '../services/SubtitleService.js';
import native from '../utils/native-loader.js';
import axios from 'axios';

const router = Router();

router.get('/tracks', (req, res) => {
  const { path } = req.query;
  if (!path || typeof path !== 'string') return res.status(400).send('Path required');
  try {
    const tracks = native.getSubtitleTracks(path);
    res.json({ data: tracks });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/extract', (req, res) => {
  const { path, index } = req.query;
  if (!path || typeof path !== 'string') return res.status(400).send('Path required');
  try {
    const content = native.extractSubtitleStream(path, Number(index));
    res.json({ data: content });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/hash', async (req, res) => {
  const { path } = req.query;
  if (!path || typeof path !== 'string') return res.status(400).send('Path required');
  try {
    const hash = await SubtitleService.calculateOpenSubtitlesHash(path);
    res.json({ data: hash });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/search', async (req, res) => {
  const { hash, filename } = req.query;
  if (!hash || typeof hash !== 'string') return res.status(400).send('Hash required');
  try {
    // OpenSubtitles API simulation (as we can't really call it without an API key/real setup)
    // In a real app, this would use axios to call OpenSubtitles REST API
    res.json({ data: [] });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/parse', (req, res) => {
  const { content, format } = req.body;
  let cues: SubtitleCue[] = [];
  if (format === 'srt') cues = SubtitleService.parseSRT(content);
  else if (format === 'vtt') cues = SubtitleService.parseVTT(content);
  else if (format === 'ass') cues = SubtitleService.parseASS(content);
  res.json({ data: cues });
});

export default router;
