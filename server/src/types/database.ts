export interface Track {
    id: string;
    title: string;
    artist: string | null;
    album: string | null;
    genre: string | null;
    year: number | null;
    duration: number;
    bitrate: number | null;
    sample_rate: number | null;
    channels: number | null;
    file_path: string;
    file_size: number;
    mtime: number;
    added_at: number;
    loudness: number | null;
    bpm: number | null;
    key: string | null;
    camelot_key: string | null;
    bpm_confidence: number | null;
    cover_cache_path: string | null;
    thumbnail_path: string | null;
    missing: number;
    metadata_json: string | null;
}

export interface WatchedFolder {
    path: string;
    added_at: number;
}

export interface Playlist {
    id: string;
    name: string;
    created_at: number;
}

export interface PlaylistTrack {
    playlist_id: string;
    track_id: string;
    position: number;
}

export interface SmartPlaylist {
    id: string;
    name: string;
    definition: string;
    created_at: number;
    updated_at: number;
}

export interface PlayEvent {
    id: number;
    track_id: string;
    started_at: number;
    ended_at: number | null;
    position: number | null;
    completed: number; // SQLite boolean as 0 or 1
}

export interface FingerprintCache {
    fingerprint: string;
    result: string;
    fetched_at: number;
}

export interface LyricsCache {
    track_id: string;
    synced_lyrics: string | null;
    plain_lyrics: string | null;
    source: string | null;
    fetched_at: number;
}

export interface Setting {
    key: string;
    value: string | null;
}

export interface SyncLog {
    id: string;
    type: string;
    payload: string;
    device_id: string;
    timestamp: number;
}
