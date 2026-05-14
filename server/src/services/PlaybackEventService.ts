import db from '../db/index.js';

export class PlaybackEventService {
  static startEvent(
    trackId: string,
    source: string = 'library',
    deviceId?: string,
  ): number | bigint {
    const startedAt = Math.floor(Date.now() / 1000);
    const result = db
      .prepare(
        `INSERT INTO play_events (track_id, started_at, source, device_id)
         VALUES (?, ?, ?, ?)`,
      )
      .run(trackId, startedAt, source, deviceId ?? null);
    return result.lastInsertRowid;
  }

  static endEvent(
    eventId: number | bigint,
    secondsPlayed: number,
    completed: boolean,
    skipped: boolean,
  ): void {
    // Ignore very short plays (< 5 seconds) — still record the row but don't count stats
    if (secondsPlayed < 5) return;

    const endedAt = Math.floor(Date.now() / 1000);
    db.prepare(
      `UPDATE play_events
       SET ended_at = ?, seconds_played = ?, completed = ?, skipped = ?
       WHERE id = ?`,
    ).run(endedAt, secondsPlayed, completed ? 1 : 0, skipped ? 1 : 0, eventId);

    const event = db
      .prepare('SELECT track_id FROM play_events WHERE id = ?')
      .get(eventId) as { track_id: string } | undefined;

    if (event) {
      this.updateTrackCounts(event.track_id, completed, skipped);
      this.updateDailyStats(secondsPlayed);
    }
  }

  private static updateTrackCounts(
    trackId: string,
    completed: boolean,
    skipped: boolean,
  ): void {
    if (completed) {
      db.prepare('UPDATE tracks SET play_count = play_count + 1 WHERE id = ?').run(trackId);
    }
    if (skipped) {
      db.prepare('UPDATE tracks SET skip_count = skip_count + 1 WHERE id = ?').run(trackId);
    }
  }

  private static updateDailyStats(secondsPlayed: number): void {
    const date = new Date().toISOString().split('T')[0];
    db.prepare(
      `INSERT INTO daily_stats (date, total_seconds, track_count)
       VALUES (?, ?, 1)
       ON CONFLICT(date) DO UPDATE SET
         total_seconds = total_seconds + excluded.total_seconds,
         track_count = track_count + 1`,
    ).run(date, Math.floor(secondsPlayed));
  }

  static updateCoplay(sessionTracks: string[]): void {
    if (sessionTracks.length < 2) return;

    for (let i = 0; i < sessionTracks.length; i++) {
      for (let j = i + 1; j < sessionTracks.length; j++) {
        const a = sessionTracks[i];
        const b = sessionTracks[j];
        if (a === b) continue;

        const [first, second] = a < b ? [a, b] : [b, a];

        db.prepare(
          `INSERT INTO track_coplay (track_a, track_b, score)
           VALUES (?, ?, 1)
           ON CONFLICT(track_a, track_b) DO UPDATE SET score = score + 1`,
        ).run(first, second);
      }
    }
  }
}