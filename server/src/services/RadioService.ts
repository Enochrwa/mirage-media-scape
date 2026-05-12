import Database from 'better-sqlite3';
import fetch from 'node-fetch';

export interface RadioBrowserStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved?: string;
  favicon?: string;
  country?: string;
  countrycode?: string;
  language?: string;
  tags?: string;
  codec?: string;
  bitrate?: number;
}

export class RadioService {
  private static API_URL = 'https://de1.api.radio-browser.info/json';

  constructor(private db: Database.Database) {}

  async search(query: string): Promise<RadioBrowserStation[]> {
    try {
      const res = await fetch(`${RadioService.API_URL}/stations/search?name=${encodeURIComponent(query)}&limit=20&hidebroken=true`);
      if (res.ok) {
        const data = await res.json() as any[];
        this.cacheStations(data);
        return data;
      }
    } catch (e) {
      console.error('Radio search failed', e);
    }
    return [];
  }

  async getTopStations(): Promise<RadioBrowserStation[]> {
    try {
      const res = await fetch(`${RadioService.API_URL}/stations/topclick/50`);
      if (res.ok) {
        const data = await res.json() as any[];
        this.cacheStations(data);
        return data;
      }
    } catch (e) {
      console.error('Failed to fetch top stations', e);
    }
    return [];
  }

  async getStationsByTag(tag: string): Promise<RadioBrowserStation[]> {
    try {
      const res = await fetch(`${RadioService.API_URL}/stations/bytag/${encodeURIComponent(tag)}?limit=50&hidebroken=true`);
      if (res.ok) {
        const data = await res.json() as any[];
        this.cacheStations(data);
        return data;
      }
    } catch (e) {
      console.error('Radio tag search failed', e);
    }
    return [];
  }

  private cacheStations(stations: any[]) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO radio_stations (
        stationuuid, name, url, url_resolved, country, countrycode,
        language, tags, bitrate, codec, favicon, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of stations) {
      stmt.run(
        s.stationuuid, s.name, s.url, s.url_resolved, s.country,
        s.countrycode, s.language, s.tags, s.bitrate, s.codec,
        s.favicon, Date.now()
      );
    }
  }
}
