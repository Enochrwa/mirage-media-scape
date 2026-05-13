export interface Track {
  id: string;
  filePath: string;
  fileType: 'audio' | 'video';
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: number;
  genre: string;
  trackNumber: number;
  discNumber: number;
  duration: number;
  bpm: number;
  key: string;
  camelotKey: string;
  energy: number;
  loudness: number;
  replayGainDb: number;
  coverCachePath: string;
  thumbnailPath: string;
  missing: number;
  rating: number;
  playCount: number;
  skipCount: number;
  addedAt: number;
}
