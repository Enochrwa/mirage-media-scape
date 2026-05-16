import { Router } from 'express';
import db from '../db/index.js';
import { SmartPlaylistService } from '../services/SmartPlaylistService.js';

const router = Router();
const smartService = new SmartPlaylistService(db);

router.get('/', (req, res) => {
  const playlists = db.prepare('SELECT * FROM playlists').all();
  res.json({ data: playlists });
});

router.post('/', (req, res) => {
  const { id, name, description } = req.body;
  db.prepare(
    'INSERT INTO playlists (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, name, description, Date.now(), Date.now());
  res.json({ data: { success: true } });
});

router.get('/smart', (req, res) => {
  const smartPlaylists = db.prepare('SELECT * FROM smart_playlists').all();
  res.json({ data: smartPlaylists });
});

router.get('/smart/:id/tracks', (req, res) => {
  const sp = db
    .prepare('SELECT definition FROM smart_playlists WHERE id = ?')
    .get(req.params.id) as { definition: string };
  if (!sp) return res.status(404).json({ error: 'Smart playlist not found' });

  const tracks = smartService.evaluate(JSON.parse(sp.definition));
  res.json({ data: tracks });
});

export default router;
