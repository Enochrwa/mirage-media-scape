export interface TrackMetadata {
  title?: string;
  artist?: string;
  albumArtist?: string;
  album?: string;
  year?: number;
  genre?: string;
  trackNumber?: number;
  discNumber?: number;
  duration: number;
  sampleRate?: number;
  bitRate?: number;
  channels?: number;
  hasVideo: boolean;
  coverArtBytes?: number[];
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

export interface HardwareCodecSupport {
  h264: boolean;
  hevc: boolean;
  av1: boolean;
  vp9: boolean;
}
