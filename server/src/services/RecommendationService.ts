import Database from 'better-sqlite3';
import { Track } from '../types/database';

export interface ScoredTrack {
  track: Track;
  similarity: number;
  coplayScore: number;
  totalScore: number;
}

export class RecommendationService {
  constructor(private db: Database.Database) {}

  public async recommend(trackId: string, limit: number = 20): Promise<Track[]> {
    const source = this.db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId) as Track;
    if (!source) return [];

    const sourceVector = this.getFeatureVector(source);

    // Fetch potential candidates (same genre, similar BPM, or co-played)
    const candidates = this.db
      .prepare(
        `
      SELECT * FROM tracks
      WHERE id != ?
      AND missing = 0
      AND (
        genre = ?
        OR (bpm BETWEEN ? AND ?)
        OR id IN (SELECT track_b FROM track_coplay WHERE track_a = ?)
      )
    `,
      )
      .all(
        trackId,
        source.genre,
        (source.bpm || 120) - 20,
        (source.bpm || 120) + 20,
        trackId,
      ) as Track[];

    const scored: ScoredTrack[] = candidates.map((track) => {
      const targetVector = this.getFeatureVector(track);
      const similarity = this.cosineSimilarity(sourceVector, targetVector);

      const coplay = this.db
        .prepare('SELECT score FROM track_coplay WHERE track_a = ? AND track_b = ?')
        .get(trackId, track.id) as { score: number } | undefined;
      const coplayScore = coplay ? coplay.score : 0;

      // Weighted scoring: 40% similarity, 60% coplay signal
      const totalScore = similarity * 0.4 + Math.min(coplayScore / 10, 1) * 0.6;

      return { track, similarity, coplayScore, totalScore };
    });

    return scored
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit)
      .map((s) => s.track);
  }

  private getFeatureVector(track: Track): number[] {
    return [
      (track.bpm || 120) / 250,
      (track.loudness || -14) / -60,
      track.year ? (track.year - 1950) / 80 : 0.5,
      // Add more features like energy/danceability if extracted
    ];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let mA = 0;
    let mB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      mA += a[i] * a[i];
      mB += b[i] * b[i];
    }
    const mag = Math.sqrt(mA) * Math.sqrt(mB);
    return mag === 0 ? 0 : dot / mag;
  }
}
