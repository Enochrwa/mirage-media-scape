import { SmartPlaylistService } from '../src/services/SmartPlaylistService';
import db from '../src/db';

// Mock DB
jest.mock('../src/db', () => ({
  prepare: jest.fn().mockReturnThis(),
  all: jest.fn(),
  get: jest.fn(),
}));

describe('SmartPlaylistService', () => {
  it('should generate correct SQL for "is" operator', () => {
    const rules = {
      matchMode: 'all' as const,
      conditions: [{ field: 'artist', operator: 'is' as const, value: 'Test Artist' }],
    };

    SmartPlaylistService.evaluate(rules);

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('LOWER(artist) = ?'));
    expect(db.prepare(expect.anything()).all).toHaveBeenCalledWith('Test Artist');
  });

  it('should generate correct SQL for "contains" operator', () => {
    const rules = {
      matchMode: 'any' as const,
      conditions: [{ field: 'title', operator: 'contains' as const, value: 'Love' }],
    };

    SmartPlaylistService.evaluate(rules);

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('LOWER(title) LIKE ?'));
    expect(db.prepare(expect.anything()).all).toHaveBeenCalledWith('%love%');
  });

  it('should respect limits', () => {
    const rules = {
      matchMode: 'all' as const,
      conditions: [],
      limit: 50,
    };

    SmartPlaylistService.evaluate(rules);

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'));
    expect(db.prepare(expect.anything()).all).toHaveBeenCalledWith(50);
  });

  it('should filter out invalid fields', () => {
    const rules = {
      matchMode: 'all' as const,
      conditions: [{ field: 'drop table tracks', operator: 'is' as const, value: 'bad' }],
    };

    SmartPlaylistService.evaluate(rules);

    expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM tracks');
  });
});
