import native from '../utils/native-loader.js';
import path from 'path';
import crypto from 'node:crypto';
import fs from 'node:fs';

export interface Db {
  pragma(sql: string): void;
  prepare(sql: string): {
    run(...args: unknown[]): unknown;
    get(...args: unknown[]): unknown;
    all(...args: unknown[]): unknown[];
  };
  close(): void;
}

import type { TrackMetadata } from '../../zovyra-native.js';

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
  codec?: string | null;
  replaygain_track_gain?: number | null;
  replaygain_track_peak?: number | null;
  replaygain_album_gain?: number | null;
  replaygain_album_peak?: number | null;
  encoder_delay?: number | null;
  encoder_padding?: number | null;
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
    .prepare('SELECT last_modified, id, file_size, fingerprint FROM tracks WHERE file_path = ?')
    .get(filePath) as { last_modified: number; id: string; file_size: number; fingerprint?: string } | undefined;

  if (existing && existing.last_modified === mtime && existing.file_size === fileSize) {
    return null; // unchanged
  }

  const metadata: TrackMetadata = native.extractMetadata(filePath);

  const id = existing?.id ?? crypto.randomUUID();

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

  const chaptersJson =
    metadata.chapters && metadata.chapters.length > 0
      ? JSON.stringify({
          chapters: metadata.chapters.map((c) => ({ time: c.startTimeMs / 1000, title: c.title })),
        })
      : null;

  db.prepare(
    `INSERT OR REPLACE INTO tracks (
      id, file_path, file_type, title, artist, album, album_artist,
      year, genre, track_number, disc_number, duration,
      sample_rate, bitrate, channels, codec,
      replaygain_track_gain, replaygain_track_peak,
      replaygain_album_gain, replaygain_album_peak,
      encoder_delay, encoder_padding,
      waveform_data, metadata_json,
      cover_cache_path, thumbnail_path,
      fingerprint,
      last_modified, mtime, file_size, added_at, updated_at, missing
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
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
    metadata.codecName ?? null,
    metadata.replaygainTrackGain ?? null,
    metadata.replaygainTrackPeak ?? null,
    metadata.replaygainAlbumGain ?? null,
    metadata.replaygainAlbumPeak ?? null,
    metadata.encoderDelay ?? null,
    metadata.encoderPadding ?? null,
    null,  // waveform_data — deferred to async background waveform worker
    chaptersJson,
    coverCachePath,
    thumbnailPath,
    existing?.fingerprint ?? null,
    mtime,
    mtime,
    fileSize,
    Date.now(),
    Date.now(),
  );

  // Save chapters to dedicated table
  db.prepare('DELETE FROM track_chapters WHERE track_id = ?').run(id);
  if (metadata.chapters && metadata.chapters.length > 0) {
    const insertChapter = db.prepare(`
      INSERT INTO track_chapters (track_id, chapter_index, title, start_time_ms, end_time_ms)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const chapter of metadata.chapters) {
      insertChapter.run(
        id,
        chapter.index,
        chapter.title ?? null,
        chapter.startTimeMs,
        chapter.endTimeMs,
      );
    }
  }

  // Save audio streams to dedicated table
  db.prepare('DELETE FROM track_audio_streams WHERE track_id = ?').run(id);
  if (metadata.audioStreams && metadata.audioStreams.length > 0) {
    const insertAudioStream = db.prepare(`
      INSERT INTO track_audio_streams (track_id, stream_index, language, codec_name, channels, sample_rate)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const stream of metadata.audioStreams) {
      insertAudioStream.run(
        id,
        stream.index,
        stream.language ?? null,
        stream.codecName ?? null,
        stream.channels ?? null,
        stream.sampleRate ?? null,
      );
    }
  }

  // Save subtitle streams to dedicated table
  db.prepare('DELETE FROM track_subtitle_streams WHERE track_id = ?').run(id);
  if (metadata.subtitleStreams && metadata.subtitleStreams.length > 0) {
    const insertSubtitleStream = db.prepare(`
      INSERT INTO track_subtitle_streams (track_id, stream_index, language, codec_name)
      VALUES (?, ?, ?, ?)
    `);
    for (const stream of metadata.subtitleStreams) {
      insertSubtitleStream.run(
        id,
        stream.index,
        stream.language ?? null,
        stream.codecName ?? null,
      );
    }
  }

  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as ProcessedTrack;
  return track;
}
