import db from '../db';
import { Track } from '../types/database';

export class RecommendationService {
  /**
   * Finds tracks similar to the target track based on BPM, Key, and Loudness.
   * Uses a multi-pass approach:
   * 1. Direct BPM match (+/- 10%)
   * 2. Key/Camelot Match
   * 3. Loudness similarity
   */
  static findSimilar(targetId: string, limit: number = 10): Track[] {
    const target = db.prepare('SELECT * FROM tracks WHERE id = ?').get(targetId) as
      | Track
      | undefined;
    if (!target) return [];

    // Simple vector similarity in SQL for efficiency
    // We prioritize BPM and Key
    const bpmMin = (target.bpm || 120) * 0.9;
    const bpmMax = (target.bpm || 120) * 1.1;

    const similar = db
      .prepare(
        `
            SELECT * FROM tracks
            WHERE id != ?
            AND (
                (bpm BETWEEN ? AND ?)
                OR (camelot_key = ?)
                OR (ABS(loudness - ?) < 3.0)
            )
            ORDER BY
                (CASE WHEN camelot_key = ? THEN 1 ELSE 0 END) DESC,
                ABS(bpm - ?) ASC
            LIMIT ?
        `,
      )
      .all(
        target.id,
        bpmMin,
        bpmMax,
        target.camelot_key,
        target.loudness || -10,
        target.camelot_key,
        target.bpm || 120,
        limit,
      ) as Track[];

    return similar;
  }
}
