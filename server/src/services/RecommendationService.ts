import db from '../db';

export interface AudioFeatures {
  bpm: number;
  loudness: number;
}

export interface SimilarTrack extends AudioFeatures {
  id: string;
  title?: string;
  artist?: string;
  score: number;
}

export class RecommendationService {
  static findSimilar(targetId: string, limit: number = 10): SimilarTrack[] {
    const target = db
      .prepare('SELECT bpm, loudness FROM tracks WHERE id = ?')
      .get(targetId) as AudioFeatures | undefined;

    if (!target || !target.bpm || target.loudness === null) {
      return [];
    }

    const allTracks = db
      .prepare(
        `
            SELECT id, title, artist, bpm, loudness
            FROM tracks
            WHERE id != ? AND bpm BETWEEN ? AND ?
        `,
      )
      .all(targetId, target.bpm - 30, target.bpm + 30) as (AudioFeatures & { id: string; title?: string; artist?: string })[];

    const scored: SimilarTrack[] = allTracks.map((track) => {
      if (!track.bpm || track.loudness === null || track.loudness === undefined) {
        return {
          id: track.id,
          title: track.title,
          artist: track.artist,
          bpm: track.bpm ?? 0,
          loudness: typeof track.loudness === 'number' ? track.loudness : 0,
          score: 0,
        };
      }

      const score = this.calculateSimilarity(target, {
        bpm: track.bpm,
        loudness: track.loudness,
      });
      return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        bpm: track.bpm,
        loudness: track.loudness,
        score,
      };
    });

    return scored
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private static calculateSimilarity(a: AudioFeatures, b: AudioFeatures): number {
    const bpmDiff = Math.abs(a.bpm - b.bpm) / 140;
    const loudnessDiff = Math.abs(a.loudness - b.loudness) / 60;
    const distance = Math.sqrt(Math.pow(bpmDiff * 0.7, 2) + Math.pow(loudnessDiff * 0.3, 2));
    return Math.max(0, 1 - distance);
  }
}
