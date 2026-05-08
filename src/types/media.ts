export type MediaType = 'audio' | 'video';

export interface MediaFile {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  cover?: string;
  file: string;
  type: MediaType;
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
}

export interface Playlist {
  id: string;
  name: string;
  files: MediaFile[];
  rules?: any;
}
