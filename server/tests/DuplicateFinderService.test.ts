import { DuplicateFinderService } from '../src/services/DuplicateFinderService';
import db from '../src/db';

jest.mock('../src/db', () => ({
  prepare: jest.fn().mockReturnThis(),
  all: jest.fn(),
}));

describe('DuplicateFinderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should find candidates with same artist and duration', () => {
    const mockCandidates = [{ artist: 'Artist A', dur: 180 }];
    (db.prepare(expect.anything()).all as jest.Mock).mockReturnValue(mockCandidates);

    const result = DuplicateFinderService.findCandidates();
    expect(result).toEqual(mockCandidates);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('GROUP BY artist, dur'));
  });

  it('should group actual tracks for candidates', () => {
    const candidates = [{ artist: 'Artist A', dur: 180 }];
    const mockTracks = [
      { id: '1', artist: 'Artist A', duration: 180, file_path: 'path1' },
      { id: '2', artist: 'Artist A', duration: 180.1, file_path: 'path2' },
    ];

    (db.prepare(expect.anything()).all as jest.Mock).mockReturnValue(mockTracks);

    const result = DuplicateFinderService.getDuplicateGroups(candidates);
    expect(result).toEqual([mockTracks]);
  });
});
