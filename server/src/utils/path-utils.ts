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
  const base = path.basename(str);
  const sanitized = base.replace(/[^a-z0-9._-]/gi, '_');
  if (sanitized === '.' || sanitized === '..') return '_';
  return sanitized;
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
