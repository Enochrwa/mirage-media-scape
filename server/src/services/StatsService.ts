import db from '../db';
import { Track } from '../types/database';

export class StatsService {
  static getGlobalStats() {
    const totalTracks = db.prepare('SELECT COUNT(*) as count FROM tracks').get() as {
      count: number;
    };
    const totalPlays = db
      .prepare('SELECT COUNT(*) as count FROM play_events WHERE completed = 1 OR position > 30')
      .get() as { count: number };
    const totalTime = db.prepare('SELECT SUM(position) as time FROM play_events').get() as {
      time: number;
    };

    const topArtist = db
      .prepare(
        `
            SELECT artist, COUNT(*) as count
            FROM tracks
            JOIN play_events ON tracks.id = play_events.track_id
            GROUP BY artist
            ORDER BY count DESC
            LIMIT 1
        `,
      )
      .get() as { artist: string; count: number } | undefined;

    return {
      totalTracks: totalTracks.count,
      totalPlays: totalPlays.count,
      totalTime: Math.round(totalTime.time || 0),
      topArtist: topArtist?.artist || 'None',
    };
  }

  static getRecentActivity(limit: number = 20): (Track & { played_at: number })[] {
    return db
      .prepare(
        `
            SELECT tracks.*, play_events.started_at as played_at
            FROM tracks
            JOIN play_events ON tracks.id = play_events.track_id
            ORDER BY play_events.started_at DESC
            LIMIT ?
        `,
      )
      .all(limit) as (Track & { played_at: number })[];
  }

  static getTopTracks(limit: number = 10): (Track & { play_count: number })[] {
    return db
      .prepare(
        `
            SELECT tracks.*, COUNT(play_events.id) as play_count
            FROM tracks
            JOIN play_events ON tracks.id = play_events.track_id
            GROUP BY tracks.id
            ORDER BY play_count DESC
            LIMIT ?
        `,
      )
      .all(limit) as (Track & { play_count: number })[];
  }

  static getHistory(limit: number = 50): (Track & { played_at: number })[] {
    return this.getRecentActivity(limit);
  }

  static getStats() {
    return this.getGlobalStats();
  }
}
