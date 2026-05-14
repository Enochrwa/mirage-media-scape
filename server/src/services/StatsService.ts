import { Database } from 'better-sqlite3';

export class StatsService {
  constructor(private db: Database) {}

  getTopTracks(period: '7d' | '30d' | '90d' | 'all', limit: number = 10) {
    let timeFilter = '';
    if (period !== 'all') {
      const days = parseInt(period);
      const since = Math.floor(Date.now() / 1000) - (days * 86400);
      timeFilter = `AND started_at > ${since}`;
    }

    return this.db.prepare(`
      SELECT t.*, SUM(p.seconds_played) as total_time, COUNT(p.id) as play_count
      FROM tracks t
      JOIN play_events p ON t.id = p.track_id
      WHERE p.completed = 1 ${timeFilter}
      GROUP BY t.id
      ORDER BY total_time DESC
      LIMIT ?
    `).all(limit);
  }

  getTopArtists(period: '7d' | '30d' | '90d' | 'all', limit: number = 10) {
    let timeFilter = '';
    if (period !== 'all') {
      const days = parseInt(period);
      const since = Math.floor(Date.now() / 1000) - (days * 86400);
      timeFilter = `AND started_at > ${since}`;
    }

    return this.db.prepare(`
      SELECT t.artist, SUM(p.seconds_played) as total_time, COUNT(p.id) as play_count
      FROM tracks t
      JOIN play_events p ON t.id = p.track_id
      WHERE p.completed = 1 ${timeFilter}
      GROUP BY t.artist
      ORDER BY total_time DESC
      LIMIT ?
    `).all(limit);
  }

  getHeatmap() {
    return this.db.prepare(`
      SELECT strftime('%w', datetime(started_at,'unixepoch')) as dow,
             strftime('%H', datetime(started_at,'unixepoch')) as hour,
             COUNT(*) as count
      FROM play_events
      GROUP BY dow, hour
    `).all();
  }

  getTotalTime() {
    const row = this.db.prepare("SELECT SUM(seconds_played) as total FROM play_events").get() as { total: number };
    return row?.total || 0;
  }

  getYearRecap(year: number) {
    const start = Math.floor(new Date(`${year}-01-01`).getTime() / 1000);
    const end = Math.floor(new Date(`${year}-12-31T23:59:59`).getTime() / 1000);

    const topTrack = this.db.prepare(`
      SELECT t.*, COUNT(p.id) as count
      FROM tracks t JOIN play_events p ON t.id = p.track_id
      WHERE p.started_at BETWEEN ? AND ?
      GROUP BY t.id ORDER BY count DESC LIMIT 1
    `).get(start, end);

    const totalHours = Math.floor(this.getTotalTime() / 3600);

    return { topTrack, totalHours };
  }
}
