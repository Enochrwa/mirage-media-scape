export interface Track {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  duration?: number;
  bitrate?: number;
  sample_rate?: number;
  channels?: number;
  file_path: string;
  file_size: number;
  mtime: number;
  added_at: number;
  loudness?: number;
  bpm?: number;
  key?: string;
  camelot_key?: string;
  bpm_confidence?: number;
  cover_cache_path?: string;
  thumbnail_path?: string;
  missing: number;
  metadata_json?: string;
  rating?: number;
  play_count?: number;
  file_type?: string;
  waveform_data?: string;
  dominant_color?: string;
}

export interface Setting {
  key: string;
  value: string;
}

export interface SyncLog {
  id: string;
  type: string;
  payload: string;
  device_id: string;
  timestamp: number;
}
