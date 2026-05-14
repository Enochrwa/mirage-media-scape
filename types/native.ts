export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  duration: number;
  bitrate: number;
  sampleRate: number;
  channels: number;
  format: string;
  loudness?: number;
  bpm?: number;
  key?: string;
  scale?: string;
  camelotKey?: string;
  bpmConfidence?: number;
  energy?: number;
  danceability?: number;
}

export interface SubtitleTrackInfo {
  index: number;
  codec: string;
  language?: string;
  title?: string;
}

export interface TrackMetadata {
  title?: string;
  artist?: string;
  albumArtist?: string;
  album?: string;
  year?: number;
  genre?: string;
  trackNumber?: number;
  discNumber?: number;
  composer?: string;
  lyricist?: string;
  comment?: string;
  copyright?: string;
  encoder?: string;
  lyrics?: string;
  syncedLyrics?: string;
  duration: number;
  sampleRate?: number;
  bitRate?: number;
  channels?: number;
  codecName?: string;
  fileType: string;
  width?: number;
  height?: number;
  frameRate?: number;
  videoCodec?: string;
  audioCodec?: string;
  coverArtBytes?: number[];
  dominantColor?: string;
  replaygainTrackGain?: number;
  replaygainAlbumGain?: number;
  replaygainTrackPeak?: number;
  replaygainAlbumPeak?: number;
}

export interface AudioAnalysis {
  bpm: number;
  key: string;
  camelotKey: string;
  energy: number;
  loudness: number;
}

export interface ReplayGainResult {
  trackGain: number;
  trackPeak: number;
}

export interface SubtitleTrack {
  index: number;
  codecName: string;
  language?: string;
  title?: string;
}

export interface TagInput {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: number;
  genre?: string;
  trackNumber?: number;
  discNumber?: number;
}

export interface HardwareCodecSupport {
  h264: boolean;
  hevc: boolean;
  av1: boolean;
  vp9: boolean;
}

export interface FingerprintResult {
  fingerprint: string;
  duration: number;
}

export interface ScannedFile {
  path: string;
  mtime: number;
  size: number;
}
