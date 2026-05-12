import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { createRequire } from 'node:module';
import { TrackMetadata, AudioMetadata } from '../../zovyra-native';
import { Track } from '../types/database';

const requireNative = createRequire(__filename);
const native = requireNative('../../zovyra-native.node') as typeof import('../../zovyra-native');

const { dbPath, folders, coversDir } = workerData;
const db = new Database(dbPath);

if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

function isMediaFile(filename: string): boolean {
  const extensions = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.mp4', '.mkv', '.avi'];
  return extensions.includes(path.extname(filename).toLowerCase());
}

async function scan() {
  let scanned = 0;
  let newTracks: Track[] = [];

  // Use Rust for high-performance filesystem scanning
  const allFiles = native.scanFolders(folders);

  const total = allFiles.length;
  parentPort?.postMessage({ type: 'SCAN_START', total });

  for (const file of allFiles) {
    const filePath = file.path;
    try {
      const mtime = file.mtime;
      const fileSize = file.size;

      const existing = db
        .prepare('SELECT mtime, id, file_size FROM tracks WHERE file_path = ?')
        .get(filePath) as { mtime: number; id: string; file_size: number } | undefined;

      if (existing && existing.mtime === mtime && existing.file_size === fileSize) {
        scanned++;
        if (scanned % 10 === 0) {
          parentPort?.postMessage({ type: 'SCAN_PROGRESS', scanned, total });
        }
        continue;
      }

      const metadata: TrackMetadata = native.extractMetadata(filePath);

      // Perform deep analysis for audio files
      let analysis: AudioMetadata | null = null;
      if (!filePath.endsWith('.mp4') && !filePath.endsWith('.mkv')) {
        try {
          analysis = native.analyzeAudio(filePath);
        } catch (e) {
          console.warn(`Audio analysis failed for ${filePath}:`, e);
        }
      }

      const id = existing?.id || crypto.createHash('md5').update(filePath).digest('hex');

      const fileType: 'audio' | 'video' = metadata.fileType as 'audio' | 'video';

      let coverCachePath: string | undefined = undefined;
      if (metadata.coverArtBytes) {
        coverCachePath = path.join(coversDir, `${id}.jpg`);
        fs.writeFileSync(coverCachePath, Buffer.from(metadata.coverArtBytes));
      }

      let thumbnailPath: string | undefined = undefined;
      if (fileType === 'video') {
        thumbnailPath = path.join(coversDir, `${id}_thumb.jpg`);
        try {
          native.generateThumbnail(filePath, metadata.duration * 0.25, thumbnailPath);
        } catch (e) {
          console.warn(`Thumbnail generation failed for ${filePath}:`, e);
          thumbnailPath = undefined;
        }
      }

      let waveformData: string | undefined = undefined;
      if (fileType === 'audio') {
        try {
          const peaks = native.generateWaveform(filePath);
          waveformData = JSON.stringify(peaks);
        } catch (e) {
          console.warn(`Waveform generation failed for ${filePath}:`, e);
        }
      }

      const trackData: Track = {
        id,
        title: metadata.title || path.basename(filePath),
        artist: metadata.artist || 'Unknown Artist',
        album: metadata.album || 'Unknown Album',
        genre: metadata.genre || 'Unknown Genre',
        year: metadata.year || undefined,
        duration: metadata.duration,
        bitrate: (metadata.bitRate as number) || 0,
        sample_rate: metadata.sampleRate || undefined,
        channels: metadata.channels || undefined,
        file_path: filePath,
        file_size: fileSize,
        mtime: mtime,
        added_at: Date.now(),
        loudness: analysis?.loudness || undefined,
        bpm: analysis?.bpm || undefined,
        key: analysis?.key || undefined,
        camelot_key: analysis?.camelotKey || undefined,
        bpm_confidence: analysis?.bpmConfidence || undefined,
        cover_cache_path: coverCachePath,
        thumbnail_path: thumbnailPath,
        missing: 0,
        metadata_json: JSON.stringify({ ...metadata, analysis }),
        rating: 0,
        play_count: 0,
        file_type: fileType,
        waveform_data: waveformData,
      };

      db.prepare(
        `
                INSERT OR REPLACE INTO tracks (
                    id, title, artist, album, genre, year, duration,
                    bitrate, sample_rate, channels, file_path, file_size,
                    mtime, added_at, loudness, bpm, key, camelot_key,
                    bpm_confidence, cover_cache_path, thumbnail_path, missing, metadata_json,
                    rating, play_count, file_type, waveform_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
      ).run(
        trackData.id,
        trackData.title,
        trackData.artist,
        trackData.album,
        trackData.genre,
        trackData.year,
        trackData.duration,
        trackData.bitrate,
        trackData.sample_rate,
        trackData.channels,
        trackData.file_path,
        trackData.file_size,
        trackData.mtime,
        trackData.added_at,
        trackData.loudness,
        trackData.bpm,
        trackData.key,
        trackData.camelot_key,
        trackData.bpm_confidence,
        trackData.cover_cache_path,
        trackData.thumbnail_path,
        trackData.missing,
        trackData.metadata_json,
        trackData.rating,
        trackData.play_count,
        trackData.file_type,
        trackData.waveform_data ?? null,
      );

      newTracks.push(trackData);
      scanned++;

      if (newTracks.length >= 20) {
        parentPort?.postMessage({ type: 'NEW_TRACKS', tracks: newTracks });
        newTracks = [];
      }

      if (scanned % 10 === 0) {
        parentPort?.postMessage({ type: 'SCAN_PROGRESS', scanned, total });
      }
    } catch (error) {
      console.error(`Failed to process ${filePath}:`, error);
    }
  }

  if (newTracks.length > 0) {
    parentPort?.postMessage({ type: 'NEW_TRACKS', tracks: newTracks });
  }

  parentPort?.postMessage({ type: 'SCAN_COMPLETE', scanned, total });
}


scan();
