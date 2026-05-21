import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

// Simple file-based cache middleware as a substitute for Redis in this environment
export const cacheMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const { trackId, segment } = req.params;

  // Sanitize to prevent path traversal
  const sanitizedTrackId = path.basename(trackId);
  const sanitizedSegment = segment ? path.basename(segment) : '';

  if (sanitizedTrackId !== trackId || (segment && sanitizedSegment !== segment)) {
    return res.status(403).send('Invalid path parameters');
  }

  if (segment) {
    const cachePath = path.join(process.cwd(), 'cache', 'hls', sanitizedTrackId, sanitizedSegment);

    if (fs.existsSync(cachePath)) {
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.sendFile(cachePath);
    }
  }

  res.set('X-Cache', 'MISS');
  next();
};
