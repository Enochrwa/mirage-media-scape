import { Router } from 'express';
import db from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/user', authMiddleware, (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const rows = db.prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(userId) as { key: string, value: string }[];
    const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    res.json({ settings });
});

router.put('/user', authMiddleware, (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const { key, value, settings } = req.body;

    if (settings) {
        const stmt = db.prepare('INSERT OR REPLACE INTO user_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)');
        for (const [k, v] of Object.entries(settings)) {
            stmt.run(userId, k, String(v), Date.now());
        }
    } else if (key) {
        db.prepare('INSERT OR REPLACE INTO user_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)')
          .run(userId, key, String(value), Date.now());
    }

    res.json({ success: true });
});

export default router;
