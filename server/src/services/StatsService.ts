import db from '../db';

export class StatsService {
    static recordPlayStart(trackId: string): number {
        const result = db.prepare(`
            INSERT INTO play_events (track_id, started_at)
            VALUES (?, ?)
        `).run(trackId, Date.now());
        return result.lastInsertRowid as number;
    }

    static recordPlayEnd(eventId: number, position: number, completed: boolean) {
        db.prepare(`
            UPDATE play_events
            SET ended_at = ?, position = ?, completed = ?
            WHERE id = ?
        `).run(Date.now(), position, completed ? 1 : 0, eventId);

        // Update track play count
        if (completed || position > 30) { // Count as a play if completed or >30s
            db.prepare(`
                UPDATE tracks
                SET play_count = IFNULL(play_count, 0) + 1,
                    last_played = ?
                WHERE id = (SELECT track_id FROM play_events WHERE id = ?)
            `).run(Date.now(), eventId);
        }
    }

    static getTopTracks(limit: number = 10) {
        return db.prepare(`
            SELECT t.*, COUNT(e.id) as play_count
            FROM tracks t
            JOIN play_events e ON t.id = e.track_id
            WHERE e.completed = 1 OR e.position > 30
            GROUP BY t.id
            ORDER BY play_count DESC
            LIMIT ?
        `).all(limit);
    }

    static getHistory(limit: number = 50) {
        return db.prepare(`
            SELECT t.*, e.started_at
            FROM tracks t
            JOIN play_events e ON t.id = e.track_id
            ORDER BY e.started_at DESC
            LIMIT ?
        `).all(limit);
    }

    static getStats() {
        const totalPlays = db
            .prepare('SELECT COUNT(*) as count FROM play_events WHERE completed = 1 OR position > 30')
            .get() as { count: number } | undefined;
        const totalTime = db.prepare('SELECT SUM(position) as time FROM play_events').get() as { time: number | null } | undefined;
        const topArtist = db
            .prepare(
                `
            SELECT artist, COUNT(*) as count
            FROM tracks t
            JOIN play_events e ON t.id = e.track_id
            GROUP BY artist
            ORDER BY count DESC
            LIMIT 1
        `,
            )
            .get() as { artist: string | null; count: number } | undefined;

        return {
            totalPlays: totalPlays?.count ?? 0,
            totalTimeSeconds: totalTime?.time ?? 0,
            topArtist: topArtist?.artist ?? 'None',
        };
    }

    static getHeatmap() {
        return db.prepare(`
            SELECT
                strftime('%w', datetime(started_at/1000, 'unixepoch')) as day,
                strftime('%H', datetime(started_at/1000, 'unixepoch')) as hour,
                COUNT(*) as count
            FROM play_events
            GROUP BY day, hour
        `).all();
    }

    static getYearRecap(year: number) {
        const start = new Date(year, 0, 1).getTime();
        const end = new Date(year + 1, 0, 1).getTime();

        return {
            totalTimeSeconds: db.prepare("SELECT SUM(position) as total FROM play_events WHERE started_at BETWEEN ? AND ?").get(start, end),
            topTrack: db.prepare(`
                SELECT t.*, COUNT(e.id) as plays
                FROM tracks t
                JOIN play_events e ON t.id = e.track_id
                WHERE e.started_at BETWEEN ? AND ?
                GROUP BY t.id
                ORDER BY plays DESC
                LIMIT 1
            `).get(start, end),
            topArtist: db.prepare(`
                SELECT artist, COUNT(*) as plays
                FROM tracks t
                JOIN play_events e ON t.id = e.track_id
                WHERE e.started_at BETWEEN ? AND ?
                GROUP BY artist
                ORDER BY plays DESC
                LIMIT 1
            `).get(start, end),
        };
    }
}
