import { StatsService } from '../src/services/StatsService';
import db from '../src/db';

jest.mock('../src/db', () => ({
  prepare: jest.fn().mockReturnThis(),
  get: jest.fn(),
  all: jest.fn(),
}));

describe('StatsService', () => {
  it('should aggregate global stats', () => {
    (db.prepare(expect.anything()).get as jest.Mock)
      .mockReturnValueOnce({ count: 100 }) // totalTracks
      .mockReturnValueOnce({ count: 50 }) // totalPlays
      .mockReturnValueOnce({ time: 3600 }) // totalTime
      .mockReturnValueOnce({ artist: 'Top Artist', count: 10 }); // topArtist

    const stats = StatsService.getGlobalStats();

    expect(stats).toEqual({
      totalTracks: 100,
      totalPlays: 50,
      totalTime: 3600,
      topArtist: 'Top Artist',
    });
  });

  it('should handle missing top artist', () => {
    (db.prepare(expect.anything()).get as jest.Mock)
      .mockReturnValueOnce({ count: 0 })
      .mockReturnValueOnce({ count: 0 })
      .mockReturnValueOnce({ time: 0 })
      .mockReturnValueOnce(undefined);

    const stats = StatsService.getGlobalStats();
    expect(stats.topArtist).toBe('None');
  });
});
