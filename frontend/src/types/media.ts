export type MediaType = 'audio' | 'video';

export interface MediaFile {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  cover?: string;
  /** Video poster / filmstrip frame when available */
  thumbnail?: string;
  file: string;
  type: MediaType;
  /** Byte size when known (e.g. dashboard storage totals). */
  size?: number;
  duration?: number;
  loudness?: number;
  bpm?: number;
  camelot_key?: string;
  file_path?: string;
  key?: string;
  genre?: string;
  year?: number;
  bitrate?: string;
  sampleRate?: string;
  rating?: number;
  play_count?: number;
  /** Server-reported when scanned (audio | video). */
  file_type?: string;
  width?: number;
  height?: number;
  waveform_data?: string;
  metadata_json?: string;
  color?: string;
  dominant_color?: string;
  missing?: number;
  replay_gain_db?: number;
  replaygain_track_gain?: number;
  replaygain_track_peak?: number;
  replaygain_album_gain?: number;
  replaygain_album_peak?: number;
  codec?: string;
  gapless_disabled?: number;
  preferred_speed?: number;
  encoder_delay?: number;
  encoder_padding?: number;
  cover_cache_path?: string;
  owner_id?: string;
  owner_name?: string;
  /**
   * True for internet radio / live streams. When set, the player treats
   * `file` as an already-playable absolute stream URL (never rewritten to
   * `/api/stream/:id`, since there is no library record for the id) and
   * disables duration-based UI (seek bar, next/prev, shuffle, repeat).
   */
  isStream?: boolean;
}

export interface SmartPlaylistCondition {
  field: string;
  operator: string;
  value: string;
}

export interface SmartPlaylistDefinition {
  matchMode: 'all' | 'any';
  conditions: SmartPlaylistCondition[];
}

export interface Playlist {
  id: string;
  name: string;
  files: MediaFile[];
  rules?: SmartPlaylistDefinition;
}
