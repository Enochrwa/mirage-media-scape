import type { Database } from 'better-sqlite3';
import fetch from 'node-fetch';

type RadioStation = Record<string, unknown>;

export class RadioService {
  private apiBase = 'https://de1.api.radio-browser.info/json';

  constructor(private db: Database) {}

  async search(query: string, limit: number = 20): Promise<RadioStation[]> {
    const res = await fetch(
      `${this.apiBase}/stations/search?name=${encodeURIComponent(query)}&limit=${limit}`,
    );
    const stations = (await res.json()) as RadioStation[];
    this.cacheStations(stations);
    return stations;
  }

  async getByTag(tag: string, limit: number = 50): Promise<RadioStation[]> {
    const res = await fetch(
      `${this.apiBase}/stations/bytag/${encodeURIComponent(tag)}?limit=${limit}`,
    );
    const stations = (await res.json()) as RadioStation[];
    this.cacheStations(stations);
    return stations;
  }

  async getTop(limit: number = 20): Promise<RadioStation[]> {
    const res = await fetch(`${this.apiBase}/topclick/${limit}`);
    const stations = (await res.json()) as RadioStation[];
    this.cacheStations(stations);
    return stations;
  }

  private cacheStations(stations: RadioStation[]): void {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO radio_stations
         (stationuuid, name, url, country, tags, bitrate, codec, favicon, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const now = Math.floor(Date.now() / 1000);
    for (const s of stations) {
      stmt.run(s.stationuuid, s.name, s.url, s.country, s.tags, s.bitrate, s.codec, s.favicon, now);
    }
  }

  async toggleFavorite(
    stationuuid: string,
    meta?: { name?: string; url?: string; favicon?: string },
  ): Promise<{ favorited: boolean }> {
    const existing = this.db
      .prepare('SELECT 1 FROM radio_favorites WHERE stationuuid = ?')
      .get(stationuuid);

    if (existing) {
      this.db.prepare('DELETE FROM radio_favorites WHERE stationuuid = ?').run(stationuuid);
      return { favorited: false };
    }

    // Prefer metadata passed directly from the client (the station the user
    // is actually looking at) over the radio_stations cache, which is only
    // populated by server-proxied browse calls — most station listings are
    // fetched straight from radio-browser.info in the browser and never
    // touch that cache, so relying on it alone meant favoriting silently
    // no-opped for the vast majority of stations.
    const name = meta?.name ?? null;
    const url = meta?.url ?? null;
    const favicon = meta?.favicon ?? null;

    let row: { name?: unknown; url?: unknown; favicon?: unknown } | undefined;
    if (!name || !url) {
      row = this.db
        .prepare('SELECT * FROM radio_stations WHERE stationuuid = ?')
        .get(stationuuid) as typeof row;
    }

    const finalName = name ?? row?.name ?? 'Unknown Station';
    const finalUrl = url ?? row?.url;
    const finalFavicon = favicon ?? row?.favicon ?? null;

    if (!finalUrl) {
      // Nothing playable to save — refuse rather than insert a broken
      // favorite the user can never actually play back.
      return { favorited: false };
    }

    this.db
      .prepare(
        `INSERT INTO radio_favorites (stationuuid, name, url, favicon, added_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        stationuuid,
        String(finalName),
        String(finalUrl),
        finalFavicon ? String(finalFavicon) : null,
        // Millisecond precision: this column is only ever used to ORDER BY
        // for "most recently favorited" — second precision let two
        // favorites added in the same second tie and fall back to
        // ascending insertion order instead of true recency.
        Date.now(),
      );
    return { favorited: true };
  }

  getFavorites(): unknown[] {
    return this.db
      .prepare('SELECT * FROM radio_favorites ORDER BY added_at DESC, rowid DESC')
      .all();
  }
}
