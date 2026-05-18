import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db/index.js';
import { signToken, signRefreshToken, AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const existingCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
  const isFirstUser = existingCount === 0;

  try {
    const id = crypto.randomUUID();
    const hash = await bcrypt.hash(password, 12);
    const role = isFirstUser ? 'admin' : 'user';

    db.prepare('INSERT INTO users (id, username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, username, email || null, hash, role, Date.now());

    const user = { id, username, role };
    const accessToken = signToken(user);
    const refreshToken = signRefreshToken();

    db.prepare('INSERT INTO user_sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(refreshToken, id, Date.now() + 30 * 24 * 60 * 60 * 1000, Date.now());

    res.json({ accessToken, refreshToken, user });
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const accessToken = signToken(user);
  const refreshToken = signRefreshToken();

  db.prepare('INSERT INTO user_sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(refreshToken, user.id, Date.now() + 30 * 24 * 60 * 60 * 1000, Date.now());

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar_path }
  });
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  const session = db.prepare('SELECT * FROM user_sessions WHERE token = ? AND expires_at > ?').get(refreshToken, Date.now()) as any;
  if (!session) return res.status(401).json({ error: 'Invalid refresh token' });

  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(session.user_id) as any;
  if (!user) return res.status(401).json({ error: 'User not found' });

  const accessToken = signToken(user);
  res.json({ accessToken });
});

router.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  db.prepare('DELETE FROM user_sessions WHERE token = ?').run(refreshToken);
  res.json({ success: true });
});

router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  const user = db.prepare('SELECT id, username, email, role, avatar_path, bio, created_at FROM users WHERE id = ?').get(req.user?.id) as any;
  res.json({ user });
});

export default router;
