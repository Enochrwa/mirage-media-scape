import { Router } from 'express';
import db from '../db';
import { RadioService } from '../services/RadioService';
import { UrlValidator } from '../utils/UrlValidator';
import axios from 'axios';

const router = Router();
const radioService = new RadioService(db);

router.get('/stations', async (req, res) => {
  const { q, tag, country, limit = 20 } = req.query;
  let stations: any[] = [];
  if (q) {
    stations = await radioService.search(q as string, Number(limit));
  } else if (tag) {
    stations = await radioService.getByTag(tag as string, Number(limit));
  } else {
    stations = await radioService.getTop(Number(limit));
  }
  res.json({ data: stations });
});

router.get('/stream', async (req, res) => {
  const { url: streamUrl } = req.query;
  if (!streamUrl || typeof streamUrl !== 'string') return res.status(400).send('URL required');

  try {
    UrlValidator.validate(streamUrl);
    const response = await axios({
      method: 'get',
      url: streamUrl,
      responseType: 'stream',
      headers: { 'Icy-MetaData': '1', 'User-Agent': 'Zovyra/1.0' },
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
    response.data.pipe(res);
  } catch (e) {
    res.status(500).send('Proxy error');
  }
});

router.get('/favorites', (req, res) => {
  res.json({ data: radioService.getFavorites() });
});

router.post('/favorites', async (req, res) => {
  const { stationuuid } = req.body;
  await radioService.toggleFavorite(stationuuid);
  res.json({ data: { success: true } });
});

export default router;
