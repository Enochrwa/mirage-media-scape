import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import db from '../src/db/index.js';
import socialRouter from '../src/routes/social.js';

function startApp(): Promise<{ server: http.Server; baseUrl: string }> {
  const app = express();
  app.use(express.json());
  app.use('/api/social', socialRouter);
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function jsonGet<T>(url: string): Promise<{ status: number; body: T }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : null });
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function jsonPost<T>(url: string): Promise<{ status: number; body: T }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : null });
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function insertTrack(id: string, title: string) {
  db.prepare(
    `INSERT OR REPLACE INTO tracks (id, file_path, file_type, title, added_at)
     VALUES (?, ?, 'audio', ?, ?)`,
  ).run(id, `/fake/${id}.mp3`, title, Date.now());
}

describe('Social favorites endpoints (GET /tracks/:id/liked, GET /tracks/liked)', () => {
  const trackA = `fav-test-track-a-${Date.now()}`;
  const trackB = `fav-test-track-b-${Date.now()}`;

  beforeAll(() => {
    insertTrack(trackA, 'Favorite Test Track A');
    insertTrack(trackB, 'Favorite Test Track B');
  });

  afterAll(() => {
    db.prepare('DELETE FROM track_likes WHERE track_id IN (?, ?)').run(trackA, trackB);
    db.prepare('DELETE FROM tracks WHERE id IN (?, ?)').run(trackA, trackB);
  });

  it('reports liked: false for a track the user has not liked', async () => {
    const app = await startApp();
    const { status, body } = await jsonGet<{ liked: boolean }>(
      `${app.baseUrl}/api/social/tracks/${trackA}/liked`,
    );
    expect(status).toBe(200);
    expect(body.liked).toBe(false);
    app.server.close();
  });

  it('toggling like then checking /liked reflects the new state', async () => {
    const app = await startApp();

    const toggleOn = await jsonPost<{ liked: boolean; count: number }>(
      `${app.baseUrl}/api/social/tracks/${trackA}/like`,
    );
    expect(toggleOn.body.liked).toBe(true);

    const checked = await jsonGet<{ liked: boolean }>(
      `${app.baseUrl}/api/social/tracks/${trackA}/liked`,
    );
    expect(checked.body.liked).toBe(true);

    const toggleOff = await jsonPost<{ liked: boolean }>(
      `${app.baseUrl}/api/social/tracks/${trackA}/like`,
    );
    expect(toggleOff.body.liked).toBe(false);

    const checkedAgain = await jsonGet<{ liked: boolean }>(
      `${app.baseUrl}/api/social/tracks/${trackA}/liked`,
    );
    expect(checkedAgain.body.liked).toBe(false);

    app.server.close();
  });

  it('GET /tracks/liked lists liked tracks most-recently-liked first', async () => {
    const app = await startApp();

    await jsonPost(`${app.baseUrl}/api/social/tracks/${trackA}/like`);
    await new Promise((r) => setTimeout(r, 5));
    await jsonPost(`${app.baseUrl}/api/social/tracks/${trackB}/like`);

    const { status, body } = await jsonGet<{ data: { id: string }[] }>(
      `${app.baseUrl}/api/social/tracks/liked`,
    );

    expect(status).toBe(200);
    const ids = body.data.map((t) => t.id);
    expect(ids.indexOf(trackB)).toBeLessThan(ids.indexOf(trackA));
    expect(ids).toContain(trackA);
    expect(ids).toContain(trackB);

    // cleanup for this test's own toggles
    await jsonPost(`${app.baseUrl}/api/social/tracks/${trackA}/like`);
    await jsonPost(`${app.baseUrl}/api/social/tracks/${trackB}/like`);

    app.server.close();
  });

  it('GET /tracks/liked does not include /tracks/:trackId/liked route conflicts', async () => {
    // Regression guard: /tracks/liked (2 segments) and /tracks/:trackId/liked
    // (3 segments) must not be confused with each other by the router.
    const app = await startApp();
    const { status, body } = await jsonGet<{ data: unknown[] }>(
      `${app.baseUrl}/api/social/tracks/liked`,
    );
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    app.server.close();
  });
});
