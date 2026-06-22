import { Router } from 'express';
import db from '../db/index.js';
import { RadioService } from '../services/RadioService.js';
import { UrlValidator } from '../utils/UrlValidator.js';
import { RadioStreamProxy } from '../services/RadioStreamProxy.js';

const router = Router();
const radioService = new RadioService(db);

type RadioStation = Record<string, unknown>;

// Latest "now playing" title per stream URL, populated by the ICY metadata
// parser while a proxy stream is active. Read by GET /now-playing so the
// client can poll for the current track without re-parsing the audio
// stream itself. Capped to avoid unbounded growth across many stations.
const nowPlayingCache = new Map<string, { title: string; updatedAt: number }>();
const NOW_PLAYING_CACHE_LIMIT = 200;

function setNowPlaying(url: string, title: string) {
  if (nowPlayingCache.size >= NOW_PLAYING_CACHE_LIMIT && !nowPlayingCache.has(url)) {
    const oldestKey = nowPlayingCache.keys().next().value;
    if (oldestKey) nowPlayingCache.delete(oldestKey);
  }
  nowPlayingCache.set(url, { title, updatedAt: Date.now() });
}

router.get('/stations', async (req, res) => {
  const { q, tag, limit = 20 } = req.query;
  let stations: RadioStation[] = [];
  if (q) {
    stations = await radioService.search(q as string, Number(limit));
  } else if (tag) {
    stations = await radioService.getByTag(tag as string, Number(limit));
  } else {
    stations = await radioService.getTop(Number(limit));
  }
  res.json({ data: stations });
});

router.get('/now-playing', (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }
  const entry = nowPlayingCache.get(url);
  res.json({ data: entry ?? null });
});

/**
 * Live radio streams never naturally "end" — Icecast/Shoutcast servers
 * periodically drop the underlying TCP connection (idle timeouts, metadata-
 * interval boundaries, load balancer churn) even though the station is
 * still broadcasting. The old proxy treated any upstream close as fatal and
 * let the client's <audio> element fire `ended`, which the player store
 * then handled exactly like a finished track — pausing playback after a
 * few minutes with no indication anything had gone wrong.
 *
 * RadioStreamProxy owns reconnect-with-backoff and ICY metadata parsing;
 * this route just validates the URL(s), wires the response stream, and
 * tears the proxy down when the client disconnects.
 */
router.get('/stream', (req, res) => {
  const primaryUrl = req.query.url;
  const fallbackUrl = req.query.fallbackUrl;

  if (!primaryUrl || typeof primaryUrl !== 'string') {
    return res.status(400).send('URL required');
  }

  let validatedPrimary: string;
  let validatedFallback: string | null = null;
  try {
    validatedPrimary = UrlValidator.validate(primaryUrl);
    if (fallbackUrl && typeof fallbackUrl === 'string' && fallbackUrl !== primaryUrl) {
      validatedFallback = UrlValidator.validate(fallbackUrl);
    }
  } catch (_e) {
    return res.status(400).send('Invalid stream URL');
  }

  let headersSent = false;

  const proxy = new RadioStreamProxy({
    url: validatedPrimary,
    fallbackUrl: validatedFallback,
    onHeaders: (contentType) => {
      if (headersSent) return;
      headersSent = true;
      res.status(200);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache, no-store');
      res.setHeader('Connection', 'keep-alive');
      // Long-lived response: disable Node's default socket idle timeout so
      // our own server isn't the thing that kills it after 60-120s.
      req.socket.setTimeout(0);
      req.socket.setNoDelay(true);
      req.socket.setKeepAlive(true);
    },
    onMetadata: (title) => setNowPlaying(primaryUrl, title),
    onGiveUp: () => {
      if (!headersSent) {
        res.status(502).send('Stream unavailable after multiple attempts');
      } else if (!res.writableEnded) {
        res.end();
      }
    },
  });

  req.on('close', () => proxy.destroy());
  proxy.start(res);
});

router.get('/favorites', (req, res) => {
  res.json({ data: radioService.getFavorites() });
});

router.post('/favorites', async (req, res) => {
  const { stationuuid, name, url, favicon } = req.body;
  if (!stationuuid || typeof stationuuid !== 'string') {
    return res.status(400).json({ error: 'stationuuid is required' });
  }
  const result = await radioService.toggleFavorite(stationuuid, { name, url, favicon });
  res.json({ data: result });
});

export default router;
