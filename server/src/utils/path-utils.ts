import path from 'path';
import fs from 'fs';
import db from '../db/index.js';

/**
 * Validates that a file path exists and is within the library (watched folders).
 * This prevents Path Traversal and Unauthorized File Access.
 */
export function validatePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;

  try {
    const absolutePath = path.resolve(filePath);

    // Check if it exists
    if (!fs.existsSync(absolutePath)) return false;

    // Get watched folders
    const watchedFolders = db.prepare('SELECT path FROM watched_folders').all() as { path: string }[];

    // Path must be within a watched folder
    return watchedFolders.some(folder => {
      const folderPath = path.resolve(folder.path);
      // Ensure the absolute path starts with the folder path and they are separated by a path separator
      // or are identical (to handle the folder itself).
      return absolutePath === folderPath || absolutePath.startsWith(folderPath + path.sep);
    });
  } catch {
    return false;
  }
}
