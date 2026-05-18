import { Router } from 'express';
import { SubtitleService, type SubtitleCue } from '../services/SubtitleService.js';
import native from '../utils/native-loader.js';
import { sanitizeId, validatePath } from '../utils/path-utils.js';
import db from '../db/index.js';

const router = Router();

// Helper to get file path from ID
const getFilePath = (id: unknown): string | null => {
  if (id && typeof id === 'string') {
    const track = db
      .prepare('SELECT file_path FROM tracks WHERE id = ?')
      .get(sanitizeId(id)) as { file_path: string } | undefined;
    if (track && validatePath(track.file_path)) return track.file_path;
  }
  return null;
};

router.get('/tracks', (req, res) => {
  const filePath = getFilePath(req.query.id);
  if (!filePath) return res.status(404).send('Track not found');
  try {
    const tracks = native.getSubtitleTracks(filePath);
    res.json({ data: tracks });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/extract', (req, res) => {
  const filePath = getFilePath(req.query.id);
  if (!filePath) return res.status(404).send('Track not found');
  const indexStr = req.query.index;
  const index = parseInt(typeof indexStr === 'string' ? indexStr : 'NaN', 10);
  if (isNaN(index) || index < 0) return res.status(400).send('Invalid index');

  try {
    const content = native.extractSubtitleStream(filePath, index);
    res.json({ data: content });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/hash', async (req, res) => {
  const filePath = getFilePath(req.query.id);
  if (!filePath) return res.status(404).send('Track not found');
  try {
    const hash = await SubtitleService.calculateOpenSubtitlesHash(filePath);
    res.json({ data: hash });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/search', async (req, res) => {
  const { hash } = req.query;
  if (!hash || typeof hash !== 'string') return res.status(400).send('Hash required');
  try {
    // OpenSubtitles API simulation
    res.json({ data: [] });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/parse', (req, res) => {
  const { content, format } = req.body;
  if (typeof content !== 'string') return res.status(400).send('Content required');
  let cues: SubtitleCue[] = [];
  if (format === 'srt') cues = SubtitleService.parseSRT(content);
  else if (format === 'vtt') cues = SubtitleService.parseVTT(content);
  else if (format === 'ass') cues = SubtitleService.parseASS(content);
  else return res.status(400).send('Unsupported format');
  res.json({ data: cues });
});

export default router;
