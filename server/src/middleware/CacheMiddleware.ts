import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { sanitizeId, sanitizeFilename } from '../utils/path-utils.js';

// Simple file-based cache middleware as a substitute for Redis in this environment
export const cacheMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const { trackId, profile, segment } = req.params;

  // Sanitize to prevent path traversal
  const sanitizedTrackId = sanitizeId(trackId);
  const sanitizedProfile = profile ? sanitizeId(profile) : 'mid';
  const sanitizedSegment = segment ? sanitizeFilename(segment) : '';

  if (
    sanitizedTrackId !== trackId ||
    (profile && sanitizedProfile !== profile) ||
    (segment && sanitizedSegment !== segment)
  ) {
    return res.status(403).send('Invalid path parameters');
  }

  if (segment) {
    const cachePath = path.join(
      process.cwd(),
      'cache',
      'hls',
      sanitizedTrackId,
      sanitizedProfile,
      sanitizedSegment,
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
