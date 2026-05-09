import db from '../db';
const native = require('../../sonic-native.node');

interface AcoustIDResult {
  title: string;
  artist: string;
  album?: string;
  year?: number;
  mbid: string;
}

interface AcoustIDResponse {
  status: string;
  results: {
    recordings?: {
      id: string;
      title: string;
      artists?: { name: string }[];
      releases?: {
        title: string;
        date?: { year: number };
      }[];
    }[];
  }[];
}

export class FingerprintService {
  private static ACOUSTID_API_KEY = process.env.ACOUSTID_API_KEY || '8SdaK5z89M'; // Free demo key or user provided

  static async identifyTrack(filePath: string): Promise<AcoustIDResult | null> {
    try {
      // 1. Generate fingerprint using Rust native module
      const { fingerprint, duration } = native.generateFingerprint(filePath);

      // 2. Check local cache
      const cached = db
        .prepare('SELECT result FROM fingerprint_cache WHERE fingerprint = ?')
        .get(fingerprint) as { result: string } | undefined;
      if (cached) return JSON.parse(cached.result) as AcoustIDResult;

      // 3. Query AcoustID API
      const url = `https://api.acoustid.org/v2/lookup?client=${this.ACOUSTID_API_KEY}&fingerprint=${fingerprint}&duration=${Math.round(duration)}&meta=recordings+releases+tracks`;
      const response = await fetch(url);

      if (!response.ok) throw new Error('AcoustID API request failed');

      const data = (await response.json()) as AcoustIDResponse;
      const result = this.parseAcoustID(data);

      // 4. Cache result
      if (result) {
        db.prepare(
          'INSERT OR REPLACE INTO fingerprint_cache (fingerprint, result, fetched_at) VALUES (?, ?, ?)',
        ).run(fingerprint, JSON.stringify(result), Date.now());
      }

      return result;
    } catch (error) {
      console.error('Fingerprinting failed:', error);
      return null;
    }
  }

  private static parseAcoustID(data: AcoustIDResponse): AcoustIDResult | null {
    if (data.status !== 'ok' || !data.results || data.results.length === 0) return null;

    const bestResult = data.results[0];
    const recording = bestResult.recordings?.[0];
    if (!recording) return null;

    return {
      title: recording.title,
      artist: recording.artists?.[0]?.name || 'Unknown Artist',
      album: recording.releases?.[0]?.title,
      year: recording.releases?.[0]?.date?.year,
      mbid: recording.id,
    };
  }
}
