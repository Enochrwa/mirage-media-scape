/**
 * native/stub-build.ts
 *
 * TypeScript ESM stub that mirrors the full zovyra-native NAPI-RS API.
 *
 * Used automatically by server/src/utils/native-loader.ts when the compiled
 * .node binary is absent (i.e. during development before running the Rust
 * build, or in CI environments that only need the web/server layer).
 *
 * Every function returns a safe typed default so the server boots and all
 * non-native routes work normally.  Functions that write files or require
 * FFmpeg throw a descriptive error instead of silently doing nothing.
 *
 * To replace this with the real binary:
 *   cd native && npm run build
 */

import { statSync } from 'fs';

// Types mirrored from native/index.d.ts — kept in sync manually.
// The source of truth is the NAPI-RS generated index.d.ts.
export interface HardwareCodecSupport { h264: boolean; hevc: boolean; av1: boolean; vp9: boolean }
export interface AudioAnalysis        { bpm: number; key: string; camelotKey: string; energy: number; loudness: number }
export interface ReplayGainResult     { trackGain: number; trackPeak: number }
export interface TagInput             { title?: string; artist?: string; album?: string; albumArtist?: string; year?: number; genre?: string; trackNumber?: number; discNumber?: number }
export interface ChapterInfo          { index: number; title?: string; startTimeMs: number; endTimeMs: number }
export interface AudioStreamInfo      { index: number; language?: string; codecName?: string; channels?: number; sampleRate?: number }
export interface SubtitleStreamInfo   { index: number; language?: string; codecName?: string }
export interface TrackMetadata        { title?: string; artist?: string; albumArtist?: string; album?: string; year?: number; genre?: string; trackNumber?: number; discNumber?: number; composer?: string; lyricist?: string; comment?: string; copyright?: string; encoder?: string; lyrics?: string; syncedLyrics?: string; duration: number; sampleRate?: number; bitRate?: number; channels?: number; codecName?: string; fileType: string; width?: number; height?: number; frameRate?: number; videoCodec?: string; audioCodec?: string; coverArtBytes?: number[]; dominantColor?: string; replaygainTrackGain?: number; replaygainAlbumGain?: number; replaygainTrackPeak?: number; replaygainAlbumPeak?: number; encoderDelay?: number; encoderPadding?: number; chapters: ChapterInfo[]; audioStreams: AudioStreamInfo[]; subtitleStreams: SubtitleStreamInfo[] }
export interface ScannedFile          { path: string; mtime: number; size: number }
export interface FingerprintResult    { fingerprint: string; duration: number }
export interface SubtitleTrack        { index: number; codecName: string; language?: string; title?: string }

// ── Warn once on first import ─────────────────────────────────────────────────
console.warn(
  '\x1b[33m[zovyra-native]\x1b[0m Running in STUB mode — native FFmpeg features are disabled.\n' +
  '  → Run \x1b[36mcd native && npm run build\x1b[0m to enable full support.'
);

function stubError(fn: string): never {
  throw new Error(
    `[zovyra-native stub] ${fn}() requires the native build.\n` +
    '  Run: cd native && npm run build'
  );
}

// ── Codec detection ───────────────────────────────────────────────────────────
export function probeHardwareCodecs(): HardwareCodecSupport {
  return { h264: true, hevc: true, av1: false, vp9: true };
}

export function initializeHardwareDecode(): HardwareCodecSupport {
  return probeHardwareCodecs();
}

// ── Audio analysis ────────────────────────────────────────────────────────────
export function analyzeAudio(_path: string): AudioAnalysis {
  return { bpm: 0, key: 'C', camelotKey: '1A', energy: 0, loudness: -96 };
}
export function computeReplayGain(_paths: string[]): ReplayGainResult[] {
  return [];
}

// ── Tag writing ───────────────────────────────────────────────────────────────
export function writeTags(_path: string, _tags: TagInput): void {
  stubError('writeTags');
}

// ── Metadata extraction ───────────────────────────────────────────────────────
export function extractMetadata(_path: string): TrackMetadata {
  return { duration: 0, fileType: 'audio', chapters: [], audioStreams: [], subtitleStreams: [] };
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────
export function generateThumbnail(_path: string, _timeSeconds: number, _outputPath: string): void {
  stubError('generateThumbnail');
}

// ── Folder scanning ───────────────────────────────────────────────────────────
export function scanFolders(folders: string[]): ScannedFile[] {
  // Stub mode: we cannot enumerate real media files without FFmpeg.
  // Return [] to prevent the scan worker from treating directories as tracks.
  return [];
}

// ── Waveform / fingerprinting ─────────────────────────────────────────────────
export function generateWaveform(_path: string): number[] {
  return new Array(1000).fill(0) as number[];
}
export function generateWaveformFingerprint(_path: string): string {
  return '00'.repeat(32);
}
export function generateFingerprint(_path: string): FingerprintResult {
  return { fingerprint: '00'.repeat(32), duration: 0 };
}

// ── Subtitles ─────────────────────────────────────────────────────────────────
export function getSubtitleTracks(_path: string): SubtitleTrack[] {
  return [];
}
export function extractSubtitleStream(_path: string, _streamIndex: number): string {
  stubError('extractSubtitleStream');
}