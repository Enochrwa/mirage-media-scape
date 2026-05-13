import { Database } from 'better-sqlite3';
import fetch from 'node-fetch';
import { createRequire } from 'node:module';

const requireNative = createRequire(import.meta.url);
const native = requireNative('../../zovyra-native.node') as typeof import('../../zovyra-native');

export class FingerprintService {
  private static ACOUSTID_CLIENT_KEY = process.env.ACOUSTID_CLIENT_KEY || '8XaZ6ST0';

  static async identifyTrack(path: string, db: Database) {
    const { fingerprint, duration } = native.generateFingerprint(path);

    // Check cache
    const cached = db.prepare('SELECT result FROM fingerprint_cache WHERE fingerprint = ?').get(fingerprint) as { result: string };
    if (cached) return JSON.parse(cached.result);

    const url = `https://api.acoustid.org/v2/lookup?client=${this.ACOUSTID_CLIENT_KEY}&fingerprint=${fingerprint}&duration=${Math.floor(duration)}&meta=recordings+releases+tracks+compress`;
    const res = await fetch(url);
    const data = await res.json() as any;

    if (data.status === 'ok' && data.results.length > 0) {
      const topResult = data.results[0].recordings?.[0];
      if (topResult) {
        const metadata = {
          title: topResult.title,
          artist: topResult.artists?.[0]?.name,
          album: topResult.releases?.[0]?.title,
          year: topResult.releases?.[0]?.date?.year,
          mbid: topResult.id
        };

        db.prepare(`
          INSERT INTO fingerprint_cache (fingerprint, result, fetched_at)
          VALUES (?, ?, ?)
        `).run(fingerprint, JSON.stringify(metadata), Math.floor(Date.now() / 1000));

        return metadata;
      }
    }

    return null;
  }
}
