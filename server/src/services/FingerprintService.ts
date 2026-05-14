import type { Database } from 'better-sqlite3';
import fetch from 'node-fetch';
import native from '../utils/native-loader.js';

interface AcoustidRelease {
  title?: string;
  date?: { year?: number };
}

interface AcoustidArtist {
  name?: string;
}

interface AcoustidRecording {
  title?: string;
  artists?: AcoustidArtist[];
  releases?: AcoustidRelease[];
  id?: string;
}

interface AcoustidResult {
  recordings?: AcoustidRecording[];
}

interface AcoustidResponse {
  status?: string;
  results?: AcoustidResult[];
}

interface TrackMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  mbid?: string;
}

export class FingerprintService {
  private static ACOUSTID_CLIENT_KEY = process.env.ACOUSTID_CLIENT_KEY ?? '8XaZ6ST0';

  static async identifyTrack(filePath: string, db: Database): Promise<TrackMetadata | null> {
    const { fingerprint, duration } = native.generateFingerprint(filePath);

    // Check cache first
    const cached = db
      .prepare('SELECT result FROM fingerprint_cache WHERE fingerprint = ?')
      .get(fingerprint) as { result: string } | undefined;
    if (cached) return JSON.parse(cached.result) as TrackMetadata;

    const url =
      `https://api.acoustid.org/v2/lookup` +
      `?client=${encodeURIComponent(this.ACOUSTID_CLIENT_KEY)}` +
      `&fingerprint=${encodeURIComponent(fingerprint)}` +
      `&duration=${Math.floor(duration)}` +
      `&meta=recordings+releases+tracks+compress`;

    const res = await fetch(url);
    const data = (await res.json()) as AcoustidResponse;

    if (data.status === 'ok' && data.results && data.results.length > 0) {
      const topRecording = data.results[0].recordings?.[0];
      if (topRecording) {
        const metadata: TrackMetadata = {
          title: topRecording.title,
          artist: topRecording.artists?.[0]?.name,
          album: topRecording.releases?.[0]?.title,
          year: topRecording.releases?.[0]?.date?.year,
          mbid: topRecording.id,
        };

        db.prepare(
          `INSERT INTO fingerprint_cache (fingerprint, result, fetched_at)
           VALUES (?, ?, ?)`,
        ).run(fingerprint, JSON.stringify(metadata), Math.floor(Date.now() / 1000));

        return metadata;
      }
    }

    return null;
  }
}