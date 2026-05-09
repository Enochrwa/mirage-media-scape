export type MediaType = 'audio' | 'video';

export interface MediaFile {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  cover: string | null;
  file: string;
  type: MediaType;
  duration: number | null;
  loudness: number | null;
  bpm: number | null;
  camelot_key: string | null;
  file_path: string;
  key: string | null;
  genre: string | null;
  year: number | null;
  bitrate: number | null;
  sampleRate: number | null;
}

export type SmartPlaylistOperator =
  | 'is'
  | 'isNot'
  | 'contains'
  | 'notContains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'inLastDays';

export interface SmartPlaylistCondition {
  field: string;
  operator: SmartPlaylistOperator;
  value: string | number | number[];
}

export interface SmartPlaylistDefinition {
  matchMode: 'all' | 'any';
  conditions: SmartPlaylistCondition[];
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface Playlist {
  id: string;
  name: string;
  files: MediaFile[];
  rules?: SmartPlaylistDefinition;
  created_at?: number;
  updated_at?: number;
}
