import path from 'path';
import db from '../db/index.js';

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

    // Get watched folders from database
    const watchedFolders = db.prepare('SELECT path FROM watched_folders').all() as { path: string }[];

    let isContained = false;
    for (const folder of watchedFolders) {
      const folderPath = path.resolve(folder.path);
      const relative = path.relative(folderPath, absolutePath);

      // If relative doesn't start with '..' and is not absolute, it's inside folderPath
      // relative === '' handles the folder itself.
      if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
        isContained = true;
        break;
      }
    }

    if (!isContained) return false;

    // We've already verified containment within watched folders.
    // Return true immediately to satisfy CodeQL and avoid file existence check
    // on a potentially user-provided path. The caller can check exists if needed.
    return true;
  } catch {
    return false;
  }
}
