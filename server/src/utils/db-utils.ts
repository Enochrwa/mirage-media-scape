import path from 'path';

export function getDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.env.DATABASE_PATH);
  }

  // Fallback logic
  if (process.env.NODE_ENV === 'test') {
    return path.resolve(process.cwd(), 'zovyra.test.db');
  }

  // Development fallback
  const devPath = path.resolve(process.cwd(), 'zovyra.db');

  // If we are in production/Tauri, we might need a different path
  // but for now, we follow the current project structure
  return devPath;
}
