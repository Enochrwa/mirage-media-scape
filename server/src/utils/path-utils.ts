import path from 'path';
import db from '../db/index.js';

/**
 * Sanitize a string to be safe for use in IDs.
 */
export function sanitizeId(id: unknown): string {
  if (typeof id !== 'string') return '';
  // Use path.basename to prevent traversal and regex to limit characters
  const base = path.basename(id);
  if (base === '.' || base === '..') return '';
  const sanitized = base.replace(/[^a-z0-9_-]/gi, '');
  return sanitized;
}

/**
 * Check if a string is a valid ID (alphanumeric, underscores, dashes).
 */
export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9_-]+$/i.test(id);
}

/**
 * Sanitize a string to be safe for use in filenames.
 * Specifically prevents dot-segment traversal by blocking '.' and '..' and removing all path separators.
 */
export function sanitizeFilename(str: unknown): string {
  if (typeof str !== 'string') return '';
  // Prevent dot-segment traversal by using path.basename and blocking specific values
  const base = path.basename(str);
  if (base === '.' || base === '..') return '_';
  // Strip any remaining dangerous characters (specifically any slashes or backslashes)
  return base.replace(/[^a-z0-9._-]/gi, '_');
}

/**
 * Ensures a path is safe to use by verifying it's within a specific root directory.
 */
export function ensureSafePath(root: string, ...segments: string[]): string {
  const sanitizedSegments = segments.map((s) => {
    const base = path.basename(s);
    if (base === '.' || base === '..') throw new Error('Path traversal attempt detected');
    return base.replace(/[^a-z0-9._-]/gi, '_');
  });

  const finalPath = path.join(root, ...sanitizedSegments);
  const absoluteRoot = path.resolve(root);
  const absoluteFinal = path.resolve(finalPath);

  if (!absoluteFinal.startsWith(absoluteRoot)) {
    throw new Error('Safe path escape detected');
  }

  return finalPath;
}

/**
 * Validates that a file path is within the library (watched folders).
 * This prevents Path Traversal and Unauthorized File Access.
 */
export function validatePath(filePath: string): boolean {
  if (typeof filePath !== 'string' || !filePath) return false;
  if (filePath.includes('\0')) return false;

  try {
    const absolutePath = path.resolve(filePath);

    // Get watched folders from database
    const watchedFolders = db.prepare('SELECT path FROM watched_folders').all() as {
      path: string;
    }[];

    for (const folder of watchedFolders) {
      // Normalize: resolve and strip trailing separators
      const folderPath = path.resolve(folder.path.replace(/[/\\]+$/, ''));
      const relative = path.relative(folderPath, absolutePath);

      // If relative doesn't start with '..' and is not absolute, it's inside folderPath
      // relative === '' handles the folder itself.
      if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
