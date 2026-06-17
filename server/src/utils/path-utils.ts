import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Go up to server root: dist/src/utils → server  OR  src/utils → server
const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const UPLOADS_ROOT = path.resolve(SERVER_ROOT, 'uploads');

/**
 * Sanitize a string to be safe for use in IDs.
 */
export function sanitizeId(id: unknown): string {
  if (typeof id !== 'string') return '';
  return id.replace(/[^a-z0-9_-]/gi, '');
}

/**
 * Sanitize a string to be safe for use in filenames.
 */
export function sanitizeFilename(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[^a-z0-9._-]/gi, '_');
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

    // Allow files inside the server's uploads directory (user-uploaded content)
    const uploadsRelative = path.relative(UPLOADS_ROOT, absolutePath);
    if (!uploadsRelative.startsWith('..') && !path.isAbsolute(uploadsRelative)) {
      return true;
    }

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
