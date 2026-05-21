import { Router } from 'express';
import db from '../db/index.js';
import { authMiddleware, AuthRequest, optionalAuth } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

router.post('/tracks/:trackId/like', authMiddleware, (req: AuthRequest, res) => {
  const { trackId } = req.params;
  const userId = req.user!.id;

  const existing = db
    .prepare('SELECT 1 FROM track_likes WHERE user_id = ? AND track_id = ?')
    .get(userId, trackId);
  if (existing) {
    db.prepare('DELETE FROM track_likes WHERE user_id = ? AND track_id = ?').run(userId, trackId);
  } else {
    db.prepare('INSERT INTO track_likes (user_id, track_id, liked_at) VALUES (?, ?, ?)').run(
      userId,
      trackId,
      Date.now(),
    );
  }

  const count = (
    db.prepare('SELECT COUNT(*) as count FROM track_likes WHERE track_id = ?').get(trackId) as {
      count: number;
    }
  ).count;
  res.json({ liked: !existing, count });
});

router.get('/tracks/:trackId/comments', optionalAuth, (req: AuthRequest, res) => {
  const { trackId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const comments = db
    .prepare(
      `
    SELECT tc.*, u.username, u.avatar_path
    FROM track_comments tc
    JOIN users u ON tc.user_id = u.id
    WHERE tc.track_id = ?
    ORDER BY tc.created_at DESC
    LIMIT ? OFFSET ?
  `,
    )
    .all(trackId, limit, offset);

  res.json({ comments });
});

router.post('/tracks/:trackId/comments', authMiddleware, (req: AuthRequest, res) => {
  const { trackId } = req.params;
  const { body, parentId } = req.body;
  if (!body || body.length > 2000) return res.status(400).json({ error: 'Invalid comment body' });

  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO track_comments (id, user_id, track_id, body, created_at, parent_id) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, req.user!.id, trackId, body, Date.now(), parentId || null);

  const comment = db
    .prepare(
      'SELECT tc.*, u.username FROM track_comments tc JOIN users u ON tc.user_id = u.id WHERE tc.id = ?',
    )
    .get(id);
  res.json({ comment });
});

router.post('/users/:userId/follow', authMiddleware, (req: AuthRequest, res) => {
  const { userId } = req.params;
  const followerId = req.user!.id;
  if (userId === followerId) return res.status(400).json({ error: 'Cannot follow yourself' });

  const existing = db
    .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?')
    .get(followerId, userId);
  if (existing) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND followed_id = ?').run(
      followerId,
      userId,
    );
  } else {
    db.prepare('INSERT INTO follows (follower_id, followed_id, followed_at) VALUES (?, ?, ?)').run(
      followerId,
      userId,
      Date.now(),
    );
  }
  res.json({ following: !existing });
});

router.get('/users/:userId/profile', optionalAuth, (req: AuthRequest, res) => {
  const { userId } = req.params;
  const user = db
    .prepare('SELECT id, username, bio, avatar_path, created_at FROM users WHERE id = ?')
    .get(userId) as
    | {
        id: string;
        username: string;
        bio: string | null;
        avatar_path: string | null;
        created_at: number;
      }
    | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const trackCount = (
    db
      .prepare('SELECT COUNT(*) as count FROM tracks WHERE owner_id = ? AND is_public = 1')
      .get(userId) as { count: number }
  ).count;
  const followerCount = (
    db.prepare('SELECT COUNT(*) as count FROM follows WHERE followed_id = ?').get(userId) as {
      count: number;
    }
  ).count;
  const followingCount = (
    db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(userId) as {
      count: number;
    }
  ).count;

  const recentTracks = db
    .prepare(
      'SELECT * FROM tracks WHERE owner_id = ? AND is_public = 1 ORDER BY added_at DESC LIMIT 5',
    )
    .all(userId);

  res.json({ user, trackCount, followerCount, followingCount, recentTracks });
});

router.get('/discover/recent', optionalAuth, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const tracks = db
    .prepare(
      `
        SELECT t.*, u.username as owner_name, (SELECT COUNT(*) FROM track_likes WHERE track_id = t.id) as likes
        FROM tracks t
        JOIN users u ON t.owner_id = u.id
        WHERE t.is_public = 1
        ORDER BY t.added_at DESC
        LIMIT ?
    `,
    )
    .all(limit);
  res.json({ tracks });
});

router.get('/discover/trending', optionalAuth, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const tracks = db
    .prepare(
      `
        SELECT t.*, u.username as owner_name, COUNT(tl.track_id) as likes
        FROM tracks t
        JOIN users u ON t.owner_id = u.id
        LEFT JOIN track_likes tl ON t.id = tl.track_id
        WHERE t.is_public = 1
        GROUP BY t.id
        ORDER BY likes DESC, t.added_at DESC
        LIMIT ?
    `,
    )
    .all(limit);
  res.json({ tracks });
});

router.get('/discover/suggested-users', authMiddleware, (req: AuthRequest, res) => {
  const limit = parseInt(req.query.limit as string) || 5;
  const users = db
    .prepare(
      `
        SELECT u.id, u.username, u.avatar_path, COUNT(t.id) as track_count
        FROM users u
        LEFT JOIN tracks t ON u.id = t.owner_id AND t.is_public = 1
        WHERE u.id != ? AND u.id NOT IN (SELECT followed_id FROM follows WHERE follower_id = ?)
        GROUP BY u.id
        ORDER BY track_count DESC
        LIMIT ?
    `,
    )
    .all(req.user!.id, req.user!.id, limit);
  res.json({ users });
});

router.get('/feed', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const feed = db
    .prepare(
      `
        SELECT t.*, u.username as owner_name
        FROM tracks t
        JOIN users u ON t.owner_id = u.id
        JOIN follows f ON t.owner_id = f.followed_id
        WHERE f.follower_id = ? AND t.is_public = 1
        ORDER BY t.added_at DESC
        LIMIT 50
    `,
    )
    .all(userId);
  res.json({ feed });
});

export default router;
