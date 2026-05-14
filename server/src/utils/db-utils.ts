import path from 'path';

export function getDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.env.DATABASE_PATH);
  }

  if (process.env.NODE_ENV === 'test') {
    return path.resolve(process.cwd(), 'zovyra.test.db');
  }

  return path.resolve(process.cwd(), 'zovyra.db');
}