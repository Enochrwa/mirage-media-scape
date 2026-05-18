import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('jwt_secret') as any;
  if (existing) return existing.value;
  const secret = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('jwt_secret', secret);
  return secret;
})();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  } | null;
}

export const authMiddleware: RequestHandler = (req: AuthRequest, res, next) => {
  const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || process.env.LOCAL_MODE === 'true';

  if (isLocal) {
    let user = db.prepare("SELECT id, username, role FROM users WHERE username = 'local'").get() as any;
    if (!user) {
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(id, 'local', crypto.randomBytes(16).toString('hex'), 'admin', Date.now());
      user = { id, username: 'local', role: 'admin' };
    }
    req.user = user;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: payload.id, username: payload.username, role: payload.role };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const optionalAuth: RequestHandler = (req: AuthRequest, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: payload.id, username: payload.username, role: payload.role };
  } catch (err) {
    req.user = null;
  }
  next();
};

export const requireRole = (role: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

export const signToken = (user: any) => {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
};

export const signRefreshToken = () => {
  return crypto.randomBytes(32).toString('hex');
};
