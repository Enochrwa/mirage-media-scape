import { Router } from 'express';
import db from '../db/index.js';
import crypto from 'crypto';

const router = Router();

interface EQPresetRow {
  id: string;
  name: string;
  bands: string;
  is_system: number;
}

router.get('/', (req, res) => {
  const presets = db.prepare('SELECT * FROM eq_presets WHERE is_system = 0').all() as EQPresetRow[];
  res.json(
    presets.map((p) => ({
      ...p,
      bands: JSON.parse(p.bands),
    })),
  );
});

router.post('/', (req, res) => {
  const { name, bands } = req.body;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO eq_presets (id, name, bands, is_system) VALUES (?, ?, ?, 0)').run(
    id,
    name,
    JSON.stringify(bands),
  );
  res.json({ id, name, bands, is_system: 0 });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM eq_presets WHERE id = ? AND is_system = 0').run(req.params.id);
  res.sendStatus(204);
});

export default router;
