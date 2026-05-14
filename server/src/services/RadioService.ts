import { Database } from 'better-sqlite3';
import fetch from 'node-fetch';

type RadioStation = Record<string, unknown>;

export class RadioService {
  private apiBase = 'https://de1.api.radio-browser.info/json';

  constructor(private db: Database) {}

  async search(query: string, limit: number = 20) {
    const res = await fetch(
      `${this.apiBase}/stations/search?name=${encodeURIComponent(query)}&limit=${limit}`,
    );
    const stations = (await res.json()) as RadioStation[];
    this.cacheStations(stations);
    return stations;
  }

  async getByTag(tag: string, limit: number = 50) {
    const res = await fetch(
      `${this.apiBase}/stations/bytag/${encodeURIComponent(tag)}?limit=${limit}`,
    );
    const stations = (await res.json()) as RadioStation[];
    this.cacheStations(stations);
    return stations;
  }

  async getTop(limit: number = 20) {
    const res = await fetch(`${this.apiBase}/topclick/${limit}`);
    const stations = (await res.json()) as RadioStation[];
    this.cacheStations(stations);
    return stations;
  }

  private cacheStations(stations: RadioStation[]) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO radio_stations (stationuuid, name, url, country, tags, bitrate, codec, favicon, cached_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = Math.floor(Date.now() / 1000);
    for (const s of stations) {
      stmt.run(s.stationuuid, s.name, s.url, s.country, s.tags, s.bitrate, s.codec, s.favicon, now);
    }
  }

  async toggleFavorite(stationuuid: string) {
    const existing = this.db
      .prepare('SELECT 1 FROM radio_favorites WHERE stationuuid = ?')
      .get(stationuuid);
    if (existing) {
      this.db.prepare('DELETE FROM radio_favorites WHERE stationuuid = ?').run(stationuuid);
    } else {
      const s = this.db
        .prepare('SELECT * FROM radio_stations WHERE stationuuid = ?')
        .get(stationuuid) as RadioStation | undefined;
      if (s) {
        this.db
          .prepare(
            `
          INSERT INTO radio_favorites (stationuuid, name, url, favicon, added_at)
          VALUES (?, ?, ?, ?, ?)
        `,
          )
          .run(
            String(s.stationuuid),
            String(s.name),
            String(s.url),
            String(s.favicon),
            Math.floor(Date.now() / 1000),
          );
      }
    }
  }

  getFavorites() {
    return this.db.prepare('SELECT * FROM radio_favorites ORDER BY added_at DESC').all();
  }
}
