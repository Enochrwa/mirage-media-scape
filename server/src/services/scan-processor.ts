import native from '../utils/native-loader.js';
import path from 'path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { TrackMetadata } from '../../zovyra-native.js';

export interface Db {
  pragma(sql: string): void;
  prepare(sql: string): {
    run(...args: unknown[]): unknown;
    get(...args: unknown[]): unknown;
    all(...args: unknown[]): unknown[];
  };
  close(): void;
}

export interface ProcessedTrack {
  id: string;
  file_path: string;
  file_type: 'audio' | 'video';
  title?: string | null;
  artist?: string | null;
  album_artist?: string | null;
  album?: string | null;
  year?: number | null;
  genre?: string | null;
  track_number?: number | null;
  disc_number?: number | null;
  duration: number;
  sample_rate?: number | null;
  bitrate?: number | null;
  channels?: number | null;
  cover_cache_path?: string | null;
  thumbnail_path?: string | null;
  last_modified: number;
  mtime: number;
  file_size: number;
}

export function processFile(
  file: { path: string; mtime: number; size: number },
  db: Db,
  coversDir: string,
): ProcessedTrack | null {
  const filePath = file.path;
  const mtime = Math.floor(file.mtime);
  const fileSize = Number(file.size);

  const existing = db
    .prepare('SELECT last_modified, id, file_size FROM tracks WHERE file_path = ?')
    .get(filePath) as { last_modified: number; id: string; file_size: number } | undefined;

  if (existing && existing.last_modified === mtime && existing.file_size === fileSize) {
    return null; // unchanged
  }

  const metadata: TrackMetadata = native.extractMetadata(filePath);
  const id = existing?.id ?? crypto.createHash('md5').update(filePath).digest('hex');

  const fileType = metadata.fileType === 'video' ? 'video' : 'audio';
  const bitRate = metadata.bitRate != null ? Number(metadata.bitRate) : null;

  let coverCachePath: string | null = null;
  if (metadata.coverArtBytes && metadata.coverArtBytes.length > 0) {
    coverCachePath = path.join(coversDir, `${id}.jpg`);
    fs.writeFileSync(coverCachePath, Buffer.from(metadata.coverArtBytes));
  }

  let thumbnailPath: string | null = null;
  if (fileType === 'video') {
    thumbnailPath = path.join(coversDir, `${id}_thumb.jpg`);
    try {
      native.generateThumbnail(filePath, metadata.duration * 0.25, thumbnailPath);
    } catch {
      thumbnailPath = null;
    }
  }

  db.prepare(
    `INSERT OR REPLACE INTO tracks (
      id, file_path, file_type, title, artist, album, album_artist,
      year, genre, track_number, disc_number, duration,
      sample_rate, bitrate, channels, cover_cache_path, thumbnail_path,
      last_modified, mtime, file_size, added_at, updated_at, missing
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  ).run(
    id,
    filePath,
    fileType,
    metadata.title ?? null,
    metadata.artist ?? null,
    metadata.album ?? null,
    metadata.albumArtist ?? null,
    metadata.year ?? null,
    metadata.genre ?? null,
    metadata.trackNumber ?? null,
    metadata.discNumber ?? null,
    metadata.duration,
    metadata.sampleRate ?? null,
    bitRate,
    metadata.channels ?? null,
    coverCachePath,
    thumbnailPath,
    mtime,
    mtime,
    fileSize,
    Date.now(),
    Date.now(),
  );

  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as ProcessedTrack;
  return track;
}
