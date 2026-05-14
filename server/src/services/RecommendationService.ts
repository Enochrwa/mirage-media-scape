import type { Database } from 'better-sqlite3';

interface TrackFeatures {
  id: string;
  bpm: number | null;
  key: string | null;
  camelot_key: string | null;
  energy: number | null;
  loudness: number | null;
  play_count: number;
  skip_count: number;
}

type TrackRow = TrackFeatures & Record<string, unknown>;

interface PopulationMedians {
  bpm: number;
  energy: number;
  loudness: number;
}

export class RecommendationService {
  constructor(private db: Database) {}

  private getPopulationMedians(): PopulationMedians {
    const getMedian = (field: string): number | null => {
      const rows = this.db
        .prepare(
          `SELECT ${field} FROM tracks
           WHERE missing = 0 AND ${field} IS NOT NULL
           ORDER BY ${field}`,
        )
        .all() as Array<Record<string, number>>;

      if (rows.length === 0) return null;
      const mid = Math.floor(rows.length / 2);
      return rows.length % 2 !== 0
        ? rows[mid][field]
        : (rows[mid - 1][field] + rows[mid][field]) / 2;
    };

    return {
      bpm: getMedian('bpm') ?? 120,
      energy: getMedian('energy') ?? 0.5,
      loudness: getMedian('loudness') ?? -14,
    };
  }

  private normalizeFeatures(track: TrackFeatures, medians: PopulationMedians): number[] {
    const bpm = (track.bpm ?? medians.bpm) / 250;
    const energy = track.energy ?? medians.energy;
    // Negative LUFS scale: louder tracks have values closer to 0
    const loudness = (track.loudness ?? medians.loudness) / -100;

    let keyVal = 0;
    let scaleVal = 0;
    if (track.camelot_key) {
      const match = track.camelot_key.match(/(\d+)([AB])/);
      if (match) {
        keyVal = (parseInt(match[1], 10) - 1) / 11;
        scaleVal = match[2] === 'B' ? 1 : 0;
      }
    }

    return [bpm, keyVal, scaleVal, energy, loudness];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  async recommend(
    trackId: string,
    limit: number = 20,
    excludeIds: string[] = [],
  ): Promise<TrackRow[]> {
    const target = this.db
      .prepare('SELECT * FROM tracks WHERE id = ?')
      .get(trackId) as TrackRow | undefined;
    if (!target) return [];

    const medians = this.getPopulationMedians();
    const targetVector = this.normalizeFeatures(target, medians);

    const candidates = this.db
      .prepare(
        `SELECT id, bpm, key, camelot_key, energy, loudness, play_count, skip_count
         FROM tracks
         WHERE id != ? AND missing = 0 AND bpm IS NOT NULL`,
      )
      .all(trackId) as TrackRow[];

    const scored = candidates
      .filter((c) => !excludeIds.includes(c.id))
      .map((c) => {
        const vector = this.normalizeFeatures(c, medians);
        let similarity = this.cosineSimilarity(targetVector, vector);

        const playCount = (c.play_count as number) ?? 0;
        const skipCount = (c.skip_count as number) ?? 0;

        // Penalise heavily-skipped tracks
        if (playCount > 0 && skipCount / (playCount + skipCount) > 0.5) {
          similarity *= 0.3;
        }
        // Boost frequently-played tracks
        if (playCount >= 3) {
          similarity *= 1.5;
        }

        return { id: c.id, score: similarity };
      });

    scored.sort((a, b) => b.score - a.score);
    const topIds = scored.slice(0, limit).map((s) => s.id);

    if (topIds.length === 0) return [];

    const placeholders = topIds.map(() => '?').join(',');
    return this.db
      .prepare(`SELECT * FROM tracks WHERE id IN (${placeholders})`)
      .all(...topIds) as TrackRow[];
  }

  async recommendBlended(trackId: string, limit: number = 20): Promise<TrackRow[]> {
    const contentRecs = await this.recommend(trackId, limit * 2);

    const coPlays = this.db
      .prepare(
        `SELECT
           CASE WHEN track_a = ? THEN track_b ELSE track_a END as other_id,
           score
         FROM track_coplay
         WHERE track_a = ? OR track_b = ?`,
      )
      .all(trackId, trackId, trackId) as { other_id: string; score: number }[];

    const maxCoPlay = coPlays.reduce((max, c) => Math.max(max, c.score), 1);
    const medians = this.getPopulationMedians();
    const targetFeatures = this.db
      .prepare('SELECT * FROM tracks WHERE id = ?')
      .get(trackId) as TrackFeatures | undefined;

    if (!targetFeatures) return [];
    const targetVector = this.normalizeFeatures(targetFeatures, medians);

    const blended = contentRecs.map((track): TrackRow & { blendedScore: number } => {
      const coPlay = coPlays.find((c) => c.other_id === track.id);
      const coPlayScore = coPlay ? coPlay.score / maxCoPlay : 0;

      const vector = this.normalizeFeatures(track, medians);
      const contentSimilarity = this.cosineSimilarity(targetVector, vector);

      const blendedScore = contentSimilarity * 0.4 + coPlayScore * 0.6;
      return { ...track, blendedScore };
    });

    blended.sort((a, b) => b.blendedScore - a.blendedScore);
    return blended.slice(0, limit);
  }

  async recommendByMood({
    energy,
    bpm,
    limit = 20,
  }: {
    energy: number;
    bpm: number;
    limit?: number;
  }): Promise<TrackRow[]> {
    const medians = this.getPopulationMedians();
    // Neutral key / scale / loudness target vector
    const targetVector = [bpm / 250, 0, 0, energy, medians.loudness / -100];

    const candidates = this.db
      .prepare('SELECT * FROM tracks WHERE missing = 0 AND bpm IS NOT NULL')
      .all() as TrackRow[];

    const scored = candidates.map((c) => {
      const vector = this.normalizeFeatures(c, medians);
      const similarity = this.cosineSimilarity(targetVector, vector);
      return { ...c, score: similarity };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }
}