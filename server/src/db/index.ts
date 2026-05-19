import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getDatabasePath } from '../utils/db-utils.js';

const dbPath = getDatabasePath();

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db: Database.Database = new Database(dbPath);

// Dynamic SQLite settings based on available RAM
// On low-RAM devices (1GB), we need to reduce cache and mmap to avoid OOM
const freeMB = os.freemem() / 1024 / 1024;

// Adaptive settings: scale down on low RAM devices
let cacheSizePages: number;
let mmapSizeBytes: number;

if (freeMB < 512) {
  // Very low RAM (< 512MB) - conservative settings
  cacheSizePages = -4000;   // ~4MB cache
  mmapSizeBytes = 16 * 1024 * 1024;  // 16MB mmap
} else if (freeMB < 1536) {
  // Low RAM (512MB - 1.5GB)
  cacheSizePages = -8000;   // ~8MB cache  
  mmapSizeBytes = 64 * 1024 * 1024;  // 64MB mmap
} else {
  // Adequate+ RAM (> 1.5GB) - default settings
  cacheSizePages = -16000;  // ~16MB cache
  mmapSizeBytes = 128 * 1024 * 1024;  // 128MB mmap
}

// Enable WAL mode for high-performance concurrent access
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma(`cache_size = ${cacheSizePages}`);
db.pragma('temp_store = MEMORY');
db.pragma(`mmap_size = ${mmapSizeBytes}`);

console.log(`SQLite initialized with cache_size=${cacheSizePages} pages, mmap_size=${mmapSizeBytes / 1024 / 1024}MB (free RAM: ${freeMB.toFixed(0)}MB)`);

// Initialize schema
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('admin','user','guest')),
      avatar_path TEXT,
      bio TEXT,
      created_at INTEGER NOT NULL,
      last_seen INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      device_info TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS track_likes (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      liked_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, track_id)
    );

    CREATE TABLE IF NOT EXISTS track_comments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      parent_id TEXT REFERENCES track_comments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followed_at INTEGER NOT NULL,
      PRIMARY KEY (follower_id, followed_id)
    );

    CREATE INDEX IF NOT EXISTS idx_likes_track ON track_likes(track_id);
    CREATE INDEX IF NOT EXISTS idx_comments_track ON track_comments(track_id);
    CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_id);

    CREATE TABLE IF NOT EXISTS watched_folders (
      path TEXT PRIMARY KEY,
      added_at INTEGER NOT NULL,
      auto_discovered INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, key)
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      file_type TEXT NOT NULL CHECK(file_type IN ('audio','video')),
      title TEXT, artist TEXT, album TEXT, album_artist TEXT,
      year INTEGER, genre TEXT, track_number INTEGER, disc_number INTEGER,
      duration REAL, sample_rate INTEGER, bitrate INTEGER, channels INTEGER,
      bpm REAL, key TEXT, camelot_key TEXT, bpm_confidence REAL, energy REAL, loudness REAL,
      codec TEXT,
      gapless_disabled INTEGER DEFAULT 0,
      replaygain_track_gain REAL,
      replaygain_track_peak REAL,
      replaygain_album_gain REAL,
      replaygain_album_peak REAL,
      preferred_speed REAL,
      encoder_delay INTEGER,
      encoder_padding INTEGER,
      waveform_data TEXT,
      metadata_json TEXT,
      cover_cache_path TEXT, thumbnail_path TEXT,
      fingerprint TEXT,
      owner_id TEXT,
      is_public INTEGER DEFAULT 0,
      upload_path TEXT,
      last_modified INTEGER, mtime INTEGER, file_size INTEGER,
      missing INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 0,
      play_count INTEGER DEFAULT 0,
      skip_count INTEGER DEFAULT 0,
      added_at INTEGER NOT NULL,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS track_chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT NOT NULL,
      chapter_index INTEGER NOT NULL,
      title TEXT,
      start_time_ms INTEGER NOT NULL,
      end_time_ms INTEGER,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS track_subtitle_streams (
      track_id TEXT NOT NULL,
      stream_index INTEGER NOT NULL,
      language TEXT,
      codec_name TEXT,
      PRIMARY KEY (track_id, stream_index),
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS track_audio_streams (
      track_id TEXT NOT NULL,
      stream_index INTEGER NOT NULL,
      language TEXT,
      codec_name TEXT,
      channels INTEGER,
      sample_rate INTEGER,
      PRIMARY KEY (track_id, stream_index),
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS playback_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      track_id TEXT,
      position_seconds REAL,
      queue_snapshot TEXT,
      queue_index INTEGER,
      timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS play_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      seconds_played REAL DEFAULT 0,
      completed INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      source TEXT DEFAULT 'library',
      device_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_play_events_track ON play_events(track_id);
    CREATE INDEX IF NOT EXISTS idx_play_events_started ON play_events(started_at);

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      total_seconds INTEGER DEFAULT 0,
      track_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      is_smart INTEGER DEFAULT 0,
      crossfade_duration_override REAL
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      added_at INTEGER,
      PRIMARY KEY (playlist_id, track_id)
    );

    CREATE TABLE IF NOT EXISTS smart_playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      definition TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER,
      is_system INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS save_for_later (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('listen','watch')),
      added_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY,
      track_id TEXT, episode_id TEXT,
      url TEXT NOT NULL,
      local_path TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','downloading','completed','error','waiting_wifi')),
      progress REAL DEFAULT 0,
      file_size INTEGER,
      downloaded_bytes INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      wifi_only INTEGER DEFAULT 1,
      error TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS smart_download_rules (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('playlist','podcast')),
      source_id TEXT NOT NULL,
      count INTEGER NOT NULL,
      wifi_only INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS podcast_subscriptions (
      id TEXT PRIMARY KEY,
      title TEXT, feed_url TEXT NOT NULL UNIQUE,
      description TEXT, artwork_url TEXT, artwork_cache_path TEXT,
      author TEXT, subscribed_at INTEGER, last_fetched INTEGER
    );

    CREATE TABLE IF NOT EXISTS podcast_episodes (
      id TEXT PRIMARY KEY,
      podcast_id TEXT NOT NULL,
      title TEXT, description TEXT,
      audio_url TEXT NOT NULL,
      published_at INTEGER, duration INTEGER,
      played INTEGER DEFAULT 0,
      progress_seconds REAL DEFAULT 0,
      downloaded INTEGER DEFAULT 0,
      download_path TEXT,
      FOREIGN KEY (podcast_id) REFERENCES podcast_subscriptions(id)
    );

    CREATE TABLE IF NOT EXISTS radio_stations (
      stationuuid TEXT PRIMARY KEY,
      name TEXT, url TEXT, country TEXT,
      tags TEXT, bitrate INTEGER, codec TEXT,
      favicon TEXT, cached_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS radio_favorites (
      stationuuid TEXT PRIMARY KEY,
      name TEXT, url TEXT, favicon TEXT, added_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS radio_history (
      stationuuid TEXT NOT NULL, played_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS eq_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bands TEXT NOT NULL,
      is_system INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS lyrics_cache (
      track_id TEXT PRIMARY KEY,
      synced_lyrics TEXT,
      plain_lyrics TEXT,
      source TEXT,
      fetched_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS lyrics_translations (
      track_id TEXT NOT NULL, language TEXT NOT NULL,
      lines TEXT NOT NULL, fetched_at INTEGER,
      PRIMARY KEY (track_id, language)
    );

    CREATE TABLE IF NOT EXISTS track_coplay (
      track_a TEXT NOT NULL, track_b TEXT NOT NULL,
      score INTEGER DEFAULT 1,
      PRIMARY KEY (track_a, track_b)
    );

    CREATE TABLE IF NOT EXISTS fingerprint_cache (
      fingerprint TEXT PRIMARY KEY,
      result TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      event_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      device_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artist_cache (
      name TEXT PRIMARY KEY,
      mbid TEXT,
      country TEXT,
      begin_year INTEGER,
      disambiguation TEXT,
      fetched_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS activity_feed (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('played','added_playlist','discovered')),
      track_id TEXT, playlist_id TEXT,
      timestamp INTEGER NOT NULL,
      device_id TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
    CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
    CREATE INDEX IF NOT EXISTS idx_tracks_added ON tracks(added_at);
    CREATE INDEX IF NOT EXISTS idx_tracks_missing ON tracks(missing, file_type);
    CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks(play_count);

    CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
        id UNINDEXED,
        title, artist, album, genre,
        tokenize='unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
        INSERT INTO tracks_fts(id, title, artist, album, genre)
        VALUES (new.id, new.title, new.artist, new.album, new.genre);
    END;

    CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
        DELETE FROM tracks_fts WHERE id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS tracks_au AFTER UPDATE ON tracks BEGIN
        DELETE FROM tracks_fts WHERE id = old.id;
        INSERT INTO tracks_fts(id, title, artist, album, genre)
        VALUES (new.id, new.title, new.artist, new.album, new.genre);
    END;
`);

// Migration: Add new columns to existing tables
const tablesInfo = {
  tracks: [
    'codec',
    'gapless_disabled',
    'replaygain_track_gain',
    'replaygain_track_peak',
    'replaygain_album_gain',
    'replaygain_album_peak',
    'preferred_speed',
    'encoder_delay',
    'encoder_padding',
    'waveform_data',
    'metadata_json',
    'analysis_version',
    'bpm',
    'key',
    'camelot_key',
    'energy',
    'loudness',
      'aspect_ratio_override',
      'rotation_degrees',
      'mirror_flip',
      'fingerprint',
      'owner_id',
      'is_public',
      'upload_path',
  ],
  playlists: ['crossfade_duration_override'],
};

for (const [table, columns] of Object.entries(tablesInfo)) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  const existingColumns = info.map((c) => c.name);
  for (const col of columns) {
    if (!existingColumns.includes(col)) {
      try {
        const type =
          col.includes('gain') ||
          col.includes('speed') ||
          col.includes('bpm') ||
          col.includes('energy') ||
          col.includes('loudness')
            ? 'REAL'
            : col.includes('delay') ||
                col.includes('padding') ||
                col.includes('disabled') ||
                col.includes('version') ||
                col.includes('degrees') ||
                col.includes('flip')
              ? 'INTEGER'
              : 'TEXT';
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      } catch (e) {
        console.warn(`Migration failed for ${table}.${col}:`, e);
      }
    }
  }
}

// Add late-binding indexes for columns added via migrations
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_tracks_owner ON tracks(owner_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tracks_fingerprint ON tracks(fingerprint);');
} catch (_e) {
  // Column might not exist yet if migration failed
}

export default db;
