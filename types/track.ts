export interface Track {
  id: string;
  file_path: string;
  file_type: 'audio' | 'video';
  title: string;
  artist: string;
  album: string;
  album_artist: string;
  year: number;
  genre: string;
  track_number: number;
  disc_number: number;
  duration: number;
  bpm: number;
  key: string;
  camelot_key: string;
  energy: number;
  loudness: number;
  replay_gain_db: number;
  cover_cache_path: string;
  thumbnail_path: string;
  missing: number;
  rating: number;
  play_count: number;
  skip_count: number;
  added_at: number;

  // Frontend compatibility fields
  file?: string;
  type?: 'audio' | 'video';
  cover?: string;
  thumbnail?: string;
  waveform_data?: string;
  metadata_json?: string;
}
