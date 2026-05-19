import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';
import fs from 'node:fs';

import native from '../utils/native-loader.js';
import path from 'path';
import crypto from 'node:crypto';

const { dbPath, coversDir } = workerData as {
  dbPath: string;
  coversDir: string;
};

if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

let scanned = 0;
let lastReported = 0;
let newTracks: Array<unknown> = [];

function sendProgress() {
  const delta = scanned - lastReported;
  if (delta > 0) {
    parentPort?.postMessage({ type: 'SCAN_PROGRESS', delta });
    lastReported = scanned;
  }
}

function sendNewTracks() {
  if (newTracks.length > 0) {
    parentPort?.postMessage({ type: 'NEW_TRACKS', tracks: newTracks });
    newTracks = [];
  }
}

parentPort?.on('message', (msg: { type: string; files: { path: string; mtime: number; size: number }[] }) => {
  if (msg.type === 'PROCESS_BATCH') {
    const files = msg.files;
    scanned = 0;
    lastReported = 0;
    newTracks = [];

    for (const file of files) {
      try {
        const filePath = file.path;
        const mtime = Math.floor(file.mtime);
        const fileSize = Number(file.size);

        const existing = db
          .prepare('SELECT last_modified, id, file_size FROM tracks WHERE file_path = ?')
          .get(filePath) as { last_modified: number; id: string; file_size: number } | undefined;

        if (existing && existing.last_modified === mtime && existing.file_size === fileSize) {
          scanned++;
          if (scanned % 10 === 0) sendProgress();
          continue;
        }

        const metadata = native.extractMetadata(filePath);
        const id = existing?.id ?? crypto.randomUUID();
        const fileType = metadata.fileType === 'video' ? 'video' : 'audio';

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
                chapters: metadata.chapters.map((c: any) => ({ time: c.startTimeMs / 1000, title: c.title })),
              })
            : null;

        const trackData = {
          id,
          file_path: filePath,
          file_type: fileType,
          title: metadata.title ?? null,
          artist: metadata.artist ?? null,
          album: metadata.album ?? null,
          album_artist: metadata.albumArtist ?? null,
          year: metadata.year ?? null,
          genre: metadata.genre ?? null,
          track_number: metadata.trackNumber ?? null,
          disc_number: metadata.discNumber ?? null,
          duration: metadata.duration,
          sample_rate: metadata.sampleRate ?? null,
          bitrate: metadata.bitRate != null ? Number(metadata.bitRate) : null,
          channels: metadata.channels ?? null,
          codec: metadata.codecName ?? null,
          replaygain_track_gain: metadata.replaygainTrackGain ?? null,
          replaygain_track_peak: metadata.replaygainTrackPeak ?? null,
          replaygain_album_gain: metadata.replaygainAlbumGain ?? null,
          replaygain_album_peak: metadata.replaygainAlbumPeak ?? null,
          encoder_delay: metadata.encoderDelay ?? null,
          encoder_padding: metadata.encoderPadding ?? null,
          chaptersJson,
          cover_cache_path: coverCachePath,
          thumbnail_path: thumbnailPath,
          last_modified: mtime,
          mtime: mtime,
          file_size: fileSize,
          metadata,
        };

        newTracks.push(trackData);
        scanned++;

        if (newTracks.length >= 20) {
          sendNewTracks();
        }
        if (scanned % 10 === 0) {
          sendProgress();
        }
      } catch (error) {
        console.error(`Failed to process ${file.path}:`, error);
      }
    }

    sendNewTracks();
    sendProgress();
    parentPort?.postMessage({ type: 'SCAN_CHUNK_COMPLETE' });
  }
});

db.close();
