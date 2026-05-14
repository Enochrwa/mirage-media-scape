import type Database from 'better-sqlite3';
import native from '../utils/native-loader.js';
import type { Track } from '../types/database.js';

export class DuplicateFinderService {
  constructor(private db: Database.Database) {}

  public async findDuplicates(): Promise<Track[][]> {
    const candidates = this.db
      .prepare(
        `SELECT id, title, artist, duration, file_path, bitrate, file_size
         FROM tracks
         WHERE missing = 0
           AND id IN (
             SELECT id FROM tracks
             GROUP BY ROUND(duration), LOWER(TRIM(artist))
             HAVING COUNT(*) > 1
           )`,
      )
      .all() as Track[];

    const groups: Record<string, Track[]> = {};
    for (const track of candidates) {
      const key = `${Math.round(track.duration ?? 0)}_${(track.artist ?? '').toLowerCase().trim()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(track);
    }

    const duplicates: Track[][] = [];

    for (const key in groups) {
      const group = groups[key];
      if (group.length < 2) continue;

      const groupDuplicates: Track[] = [];
      const fingerprints: Record<string, string> = {};

      for (const track of group) {
        try {
          const fp = native.generateWaveformFingerprint(track.file_path);
          fingerprints[track.id] = fp;
        } catch (e) {
          console.error(`Failed to generate fingerprint for ${track.file_path}:`, e);
        }
      }

      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const fp1 = fingerprints[group[i].id];
          const fp2 = fingerprints[group[j].id];

          if (fp1 && fp2 && this.hammingDistance(fp1, fp2) <= 3) {
            if (!groupDuplicates.includes(group[i])) groupDuplicates.push(group[i]);
            if (!groupDuplicates.includes(group[j])) groupDuplicates.push(group[j]);
          }
        }
      }

      if (groupDuplicates.length > 0) {
        duplicates.push(groupDuplicates);
      }
    }

    return duplicates;
  }

  private hammingDistance(h1: string, h2: string): number {
    if (h1.length !== h2.length) return 999;
    let dist = 0;
    for (let i = 0; i < h1.length; i++) {
      const b1 = parseInt(h1[i], 16);
      const b2 = parseInt(h2[i], 16);
      let x = b1 ^ b2;
      while (x > 0) {
        dist++;
        x &= x - 1;
      }
    }
    return dist;
  }
}