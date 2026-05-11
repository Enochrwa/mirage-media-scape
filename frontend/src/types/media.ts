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
