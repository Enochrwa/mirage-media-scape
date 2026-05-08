import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(__dirname, '../../sonic.db');

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for high-performance concurrent access
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Initialize schema
db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT,
        album TEXT,
        genre TEXT,
        year INTEGER,
        duration REAL,
        bitrate INTEGER,
        sample_rate INTEGER,
        channels INTEGER,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mtime INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        loudness REAL,
        bpm REAL,
        key TEXT,
        camelot_key TEXT,
        bpm_confidence REAL,
        cover_cache_path TEXT,
        thumbnail_path TEXT,
        missing INTEGER DEFAULT 0,
        metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS watched_folders (
        path TEXT PRIMARY KEY,
        added_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, track_id),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS smart_playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        definition TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS play_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        position REAL,
        completed BOOLEAN DEFAULT 0,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fingerprint_cache (
        fingerprint TEXT PRIMARY KEY,
        result TEXT NOT NULL,
        fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lyrics_cache (
        track_id TEXT PRIMARY KEY,
        synced_lyrics TEXT,
        plain_lyrics TEXT,
        source TEXT,
        fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_log (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        device_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_mtime ON tracks(mtime);
    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);

    -- Create FTS5 virtual table for tracks
    -- We don't use content='tracks' because our ID is TEXT, and FTS rowid must be INTEGER.
    -- Instead, we'll store the string ID in the FTS table to join back.
    CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
        id UNINDEXED,
        title, artist, album, genre,
        tokenize='unicode61'
    );

    -- Triggers to keep FTS index in sync
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

export default db;
