import Database from 'better-sqlite3';
import { RadioService } from '../src/services/RadioService.js';

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE radio_stations (
      stationuuid TEXT PRIMARY KEY,
      name TEXT, url TEXT, country TEXT,
      tags TEXT, bitrate INTEGER, codec TEXT,
      favicon TEXT, cached_at INTEGER
    );
    CREATE TABLE radio_favorites (
      stationuuid TEXT PRIMARY KEY,
      name TEXT, url TEXT, favicon TEXT, added_at INTEGER
    );
  `);
  return db;
}

describe('RadioService.toggleFavorite', () => {
  it('favorites a station using client-supplied metadata even when it is not in the radio_stations cache', async () => {
    // This is the real-world case: RadioPage.tsx fetches station listings
    // directly from radio-browser.info in the browser, so the server's
    // radio_stations cache (only populated by the server-proxied
    // /api/radio/stations route) is empty for it. Before the fix,
    // toggleFavorite looked the station up in that cache and silently did
    // nothing when it wasn't found.
    const db = createTestDb();
    const service = new RadioService(db);

    const result = await service.toggleFavorite('uuid-1', {
      name: 'Radio Rwanda',
      url: 'https://stream.example.com/radio-rwanda',
      favicon: 'https://example.com/favicon.png',
    });

    expect(result.favorited).toBe(true);

    const row = db.prepare('SELECT * FROM radio_favorites WHERE stationuuid = ?').get('uuid-1') as
      | { name: string; url: string; favicon: string }
      | undefined;

    expect(row).toBeDefined();
    expect(row?.name).toBe('Radio Rwanda');
    expect(row?.url).toBe('https://stream.example.com/radio-rwanda');
    expect(row?.favicon).toBe('https://example.com/favicon.png');

    db.close();
  });

  it('removes an existing favorite on the second call (toggle off)', async () => {
    const db = createTestDb();
    const service = new RadioService(db);

    await service.toggleFavorite('uuid-2', {
      name: 'Magic FM',
      url: 'https://stream.example.com/magic-fm',
    });

    const result = await service.toggleFavorite('uuid-2', {
      name: 'Magic FM',
      url: 'https://stream.example.com/magic-fm',
    });

    expect(result.favorited).toBe(false);

    const row = db.prepare('SELECT * FROM radio_favorites WHERE stationuuid = ?').get('uuid-2');
    expect(row).toBeUndefined();

    db.close();
  });

  it('falls back to the radio_stations cache when no metadata is supplied', async () => {
    const db = createTestDb();
    const service = new RadioService(db);

    db.prepare(
      `INSERT INTO radio_stations (stationuuid, name, url, country, tags, bitrate, codec, favicon, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'uuid-3',
      'Cached Station',
      'https://stream.example.com/cached',
      'RW',
      '',
      128,
      'mp3',
      '',
      0,
    );

    const result = await service.toggleFavorite('uuid-3');

    expect(result.favorited).toBe(true);
    const row = db.prepare('SELECT * FROM radio_favorites WHERE stationuuid = ?').get('uuid-3') as
      | { name: string; url: string }
      | undefined;
    expect(row?.name).toBe('Cached Station');
    expect(row?.url).toBe('https://stream.example.com/cached');

    db.close();
  });

  it('refuses to save a favorite with no playable URL from either source', async () => {
    const db = createTestDb();
    const service = new RadioService(db);

    const result = await service.toggleFavorite('uuid-4', { name: 'No URL Station' });

    expect(result.favorited).toBe(false);
    const row = db.prepare('SELECT * FROM radio_favorites WHERE stationuuid = ?').get('uuid-4');
    expect(row).toBeUndefined();

    db.close();
  });

  it('getFavorites returns saved favorites ordered by most recently added', async () => {
    const db = createTestDb();
    const service = new RadioService(db);

    await service.toggleFavorite('uuid-5', { name: 'First', url: 'https://example.com/a' });
    await service.toggleFavorite('uuid-6', { name: 'Second', url: 'https://example.com/b' });

    const favorites = service.getFavorites() as { stationuuid: string }[];
    expect(favorites.map((f) => f.stationuuid)).toEqual(['uuid-6', 'uuid-5']);

    db.close();
  });
});
