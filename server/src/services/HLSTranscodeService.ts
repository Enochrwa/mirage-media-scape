import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { sanitizeId, sanitizeFilename } from '../utils/path-utils.js';
import { TranscodeService, DeviceProfile } from './TranscodeService.js';

export interface HLSManifestResult {
  manifest: string;
  uri: string;
}

export class HLSTranscodeService {
  private static hlsDir = path.join(process.cwd(), 'cache', 'hls');
  private static activeProcesses = new Map<string, Promise<HLSManifestResult>>();

  static {
    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }
  }

  static async generateHLSManifest(
    trackId: string,
    filePath: string,
    profile: string = 'mid',
  ): Promise<HLSManifestResult> {
    const sanitizedTrackId = sanitizeId(trackId);
    const sanitizedProfile = sanitizeId(profile);
    const lockKey = `${sanitizedTrackId}:${sanitizedProfile}`;

    const existingProcess = this.activeProcesses.get(lockKey);
    if (existingProcess) return existingProcess;

    const transcodePromise = this.startTranscode(sanitizedTrackId, filePath, sanitizedProfile);
    this.activeProcesses.set(lockKey, transcodePromise);

    try {
      return await transcodePromise;
    } finally {
      this.activeProcesses.delete(lockKey);
    }
  }

  private static async startTranscode(
    trackId: string,
    filePath: string,
    profile: string,
  ): Promise<HLSManifestResult> {
    const sanitizedTrackId = sanitizeId(trackId);
    const sanitizedProfile = sanitizeId(profile);
    const trackDir = path.join(this.hlsDir, sanitizedTrackId, sanitizedProfile);
    const manifestPath = path.join(trackDir, 'playlist.m3u8');

    if (!fs.existsSync(trackDir)) {
      fs.mkdirSync(trackDir, { recursive: true });
    }

    const { audio } = TranscodeService.getBitrateConfig(profile as unknown as DeviceProfile);

    // Check if manifest already exists
    if (fs.existsSync(manifestPath)) {
      return {
        manifest: fs.readFileSync(manifestPath, 'utf8'),
        uri: `/api/stream/${sanitizedTrackId}/hls/${sanitizedProfile}/playlist.m3u8`,
      };
    }

    const ffmpegParams = [
      '-i',
      filePath,
      '-c:a',
      'aac',
      '-b:a',
      `${audio}k`,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-hls_time',
      '6',
      '-hls_list_size',
      '0',
      '-hls_segment_filename',
      path.join(trackDir, 'seg-%d.ts'),
      '-f',
      'hls',
      manifestPath,
    ];

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegParams);

      // Drain stdio to prevent hangs due to full pipe buffers
      ffmpeg.stdout.on('data', () => {});
      ffmpeg.stderr.on('data', () => {});

      ffmpeg.on('error', (err) => {
        console.error(`FFmpeg error for ${trackId}:`, err);
        reject(err);
      });

      ffmpeg.on('exit', (code) => {
        if (code !== 0 && !fs.existsSync(manifestPath)) {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      // Better manifest creation check: use fs.watch or poll with backoff
      // Increased timeout/attempts for slower systems
      let attempts = 0;
      const maxAttempts = 120; // 60 seconds total
      const poll = () => {
        if (fs.existsSync(manifestPath)) {
          // Additional check: ensure manifest isn't empty or truncated
          const content = fs.readFileSync(manifestPath, 'utf8');
          if (content.includes('#EXT-X-ENDLIST') || content.includes('#EXTINF')) {
            resolve({
              manifest: content,
              uri: `/api/stream/${sanitizedTrackId}/hls/${sanitizedProfile}/playlist.m3u8`,
            });
            return;
          }
        }

        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 500);
        } else {
          ffmpeg.kill();
          reject(new Error('HLS manifest generation timed out'));
        }
      };
      poll();
    });
  }

  static getSegmentPath(trackId: string, profile: string, segmentName: string): string {
    return path.join(
      this.hlsDir,
      sanitizeId(trackId),
      sanitizeId(profile),
      sanitizeFilename(segmentName),
    );
  }

  static getManifestPath(trackId: string, profile: string): string {
    return path.join(this.hlsDir, sanitizeId(trackId), sanitizeId(profile), 'playlist.m3u8');
  }
}
