import { describe, it, expect } from '@jest/globals';
import db from '../src/db';

describe('Database', () => {
  it('should have initialized the tracks table', () => {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tracks'")
      .get() as { name: string } | undefined;
    expect(table?.name).toBe('tracks');
  });

  it('should be in WAL mode', () => {
    const mode = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    expect(mode.journal_mode).toBe('wal');
  });
});
