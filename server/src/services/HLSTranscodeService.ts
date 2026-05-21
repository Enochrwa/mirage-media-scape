import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

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
    targetBitrate?: number,
  ): Promise<HLSManifestResult> {
    const existingProcess = this.activeProcesses.get(trackId);
    if (existingProcess) return existingProcess;

    const transcodePromise = this.startTranscode(trackId, filePath, targetBitrate);
    this.activeProcesses.set(trackId, transcodePromise);

    try {
      return await transcodePromise;
    } finally {
      this.activeProcesses.delete(trackId);
    }
  }

  private static async startTranscode(
    trackId: string,
    filePath: string,
    targetBitrate?: number,
  ): Promise<HLSManifestResult> {
    const trackDir = path.join(this.hlsDir, trackId);
    const manifestPath = path.join(trackDir, 'playlist.m3u8');

    if (!fs.existsSync(trackDir)) {
      fs.mkdirSync(trackDir, { recursive: true });
    }

    // Check if manifest already exists
    if (fs.existsSync(manifestPath)) {
      return {
        manifest: fs.readFileSync(manifestPath, 'utf8'),
        uri: `/api/stream/${trackId}/hls/playlist.m3u8`,
      };
    }

    const ffmpegParams = [
      '-i',
      filePath,
      '-c:a',
      'aac',
      '-b:a',
      targetBitrate ? `${targetBitrate}k` : '192k',
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
      let attempts = 0;
      const poll = () => {
        if (fs.existsSync(manifestPath)) {
          resolve({
            manifest: fs.readFileSync(manifestPath, 'utf8'),
            uri: `/api/stream/${trackId}/hls/playlist.m3u8`,
          });
        } else if (attempts < 20) {
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

  static getSegmentPath(trackId: string, segmentName: string): string {
    return path.join(this.hlsDir, trackId, segmentName);
  }

  static getManifestPath(trackId: string): string {
    return path.join(this.hlsDir, trackId, 'playlist.m3u8');
  }
}
