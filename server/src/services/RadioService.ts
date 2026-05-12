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

export interface MoodProfile {
  bpmRange: [number, number];
  energyMin?: number;
  energyMax?: number;
  genres: string[];
}

export const MOOD_PROFILES: Record<string, MoodProfile> = {
  focus:    { bpmRange: [60, 100],  energyMax: 0.5,  genres: ['classical','ambient','jazz','study', 'instrumental'] },
  workout:  { bpmRange: [128, 180], energyMin: 0.7,  genres: ['electronic','hip-hop','rock','edm', 'pop'] },
  worship:  { bpmRange: [60, 90],   energyMax: 0.6,  genres: ['gospel','christian','worship','spiritual', 'soul'] },
  sleep:    { bpmRange: [40, 70],   energyMax: 0.3,  genres: ['ambient','classical','acoustic','nature', 'drone'] },
  party:    { bpmRange: [120, 160], energyMin: 0.75, genres: ['pop','dance','electronic','afrobeats', 'reggaeton'] },
  chill:    { bpmRange: [70, 110],  energyMax: 0.6,  genres: ['lo-fi','jazz','indie','soul', 'r&b'] },
};

export class RadioService {
  private static API_URL = 'https://de1.api.radio-browser.info/json';

  constructor(private db: Database.Database) {}

  async getMoodTracks(mood: string): Promise<any[]> {
    const profile = MOOD_PROFILES[mood];
    if (!profile) return [];

    const [bpmMin, bpmMax] = profile.bpmRange;
    let sql = `SELECT * FROM tracks WHERE bpm BETWEEN ? AND ?`;
    const params: any[] = [bpmMin, bpmMax];

    if (profile.energyMin !== undefined) {
      // Assuming loudness or some other field approximates energy if energy column missing
      // But tracks table has loudness.
    }

    const genreConditions = profile.genres.map(g => `LOWER(genre) LIKE ?`).join(' OR ');
    sql += ` AND (${genreConditions})`;
    profile.genres.forEach(g => params.push(`%${g.toLowerCase()}%`));

    sql += ` ORDER BY RANDOM() LIMIT 50`;

    return this.db.prepare(sql).all(...params);
  }

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
