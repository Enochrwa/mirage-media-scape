import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { isValidId, sanitizeFilename } from '../utils/path-utils.js';

// Simple file-based cache middleware as a substitute for Redis in this environment
export const cacheMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const { trackId, profile, segment } = req.params;

  // Strict validation to prevent path traversal
  if (
    !isValidId(trackId) ||
    (profile && !isValidId(profile)) ||
    (segment && sanitizeFilename(segment) !== segment)
  ) {
    return res.status(403).send('Invalid path parameters');
  }

  if (segment && profile) {
    const cachePath = path.join(
      process.cwd(),
      'cache',
      'hls',
      trackId as string,
      profile as string,
      segment as string,
    );

    if (fs.existsSync(cachePath)) {
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.sendFile(cachePath);
    }
  }

  res.set('X-Cache', 'MISS');
  next();
};
