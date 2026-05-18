import type { Database } from 'better-sqlite3';
import fetch from 'node-fetch';
import { execFile, execFileSync } from 'node:child_process';

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

  private static async findFpcalc(): Promise<string | null> {
    try {
      execFileSync('which', ['fpcalc'], { stdio: 'ignore' });
      return 'fpcalc';
    } catch {
      return null;
    }
  }

  /**
   * Compute a Chromaprint fingerprint using the fpcalc binary.
   * Returns { fingerprint, duration } on success, or null if fpcalc is not available.
   */
  private static async fpcalc(filePath: string): Promise<{ fingerprint: string; duration: number } | null> {
    const bin = await this.findFpcalc();
    if (!bin) return null;
    try {
      const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) =>
        execFile(bin, ['-json', filePath], (err, stdout, stderr) =>
          err ? reject(err) : resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
        )
      );
      // fpcalc -json output: {"fingerprint":"AQAA...","duration":123.4}
      const data = JSON.parse(stdout) as { fingerprint: string; duration: number };
      return data;
    } catch {
      return null;
    }
  }

  static async identifyTrack(filePath: string, db: Database): Promise<TrackMetadata | null> {
    // fingerprint: AcoustID requires a Chromaprint fingerprint.
    // Use fpcalc (the official Chromaprint CLI) so the query hits the AcoustID database.
    const fp = await this.fpcalc(filePath);
    const { fingerprint, duration } = fp ?? { fingerprint: '', duration: 0 };

    // Check cache first
    const cached = db
      .prepare('SELECT result FROM fingerprint_cache WHERE fingerprint = ?')
      .get(fp ? fingerprint : `NOFP:${filePath}`) as { result: string } | undefined;
    if (cached) return JSON.parse(cached.result) as TrackMetadata;

    if (!fp) {
      return null;
    }

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
