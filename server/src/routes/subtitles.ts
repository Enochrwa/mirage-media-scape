import { Router } from 'express';
import { SubtitleService } from '../services/SubtitleService';
import { createRequire } from 'node:module';

const requireNative = createRequire(import.meta.url);
const native = requireNative('../../zovyra-native.node') as typeof import('../../zovyra-native');

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

router.post('/parse', (req, res) => {
  const { content, format } = req.body;
  let cues: any[] = [];
  if (format === 'srt') cues = SubtitleService.parseSRT(content);
  else if (format === 'vtt') cues = SubtitleService.parseVTT(content);
  else if (format === 'ass') cues = SubtitleService.parseASS(content);
  res.json({ data: cues });
});

export default router;
