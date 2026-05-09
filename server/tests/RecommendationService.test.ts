import { RecommendationService } from '../src/services/RecommendationService';
import db from '../src/db';

jest.mock('../src/db', () => ({
  prepare: jest.fn().mockReturnThis(),
  get: jest.fn(),
  all: jest.fn(),
}));

describe('RecommendationService', () => {
  it('should return empty array if target track not found', () => {
    (db.prepare(expect.anything()).get as jest.Mock).mockReturnValue(undefined);

    const result = RecommendationService.findSimilar('non-existent');
    expect(result).toEqual([]);
  });

  it('should query for similar tracks based on BPM and Key', () => {
    const targetTrack = {
      id: '1',
      bpm: 120,
      camelot_key: '8A',
      loudness: -8.5,
    };
    (db.prepare(expect.anything()).get as jest.Mock).mockReturnValue(targetTrack);
    (db.prepare(expect.anything()).all as jest.Mock).mockReturnValue([]);

    RecommendationService.findSimilar('1');

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('bpm BETWEEN ? AND ?'));
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('camelot_key = ?'));
  });
});
