/**
 * native/stub-build.js
 *
 * ESM stub that mimics the full zovyra-native NAPI-RS API.
 * Used automatically by the server when the compiled .node binary is absent
 * (i.e. during development without Rust/FFmpeg, or in CI before the native
 * build step has run).
 *
 * Every function returns a safe, typed default value so the server boots and
 * all non-native routes work normally.  Functions that mutate files throw a
 * clear "stub" error instead of silently doing nothing.
 *
 * To replace this with the real binary:
 *   cd native && npm run build
 */

import { statSync } from 'node:fs';

const _warned = (() => {
  console.warn(
    '\x1b[33m[zovyra-native]\x1b[0m Running in STUB mode – native FFmpeg ' +
    'features are disabled.\n' +
    '  → Run \x1b[36mcd native && npm run build\x1b[0m to enable full support.'
  );
})();

// ── Codec detection ──────────────────────────────────────────────────────────
export function probeHardwareCodecs() {
  return { h264: true, hevc: true, av1: false, vp9: true };
}

// ── Audio analysis ────────────────────────────────────────────────────────────
export function analyzeAudio(_path) {
  return { bpm: 0, key: 'C', camelotKey: '1A', energy: 0, loudness: -96 };
}
export function computeReplayGain(_paths) {
  return [];
}

// ── Tag writing ───────────────────────────────────────────────────────────────
export function writeTags(_path, _tags) {
  throw new Error('[zovyra-native stub] writeTags() requires the native build. Run: cd native && npm run build');
}

// ── Metadata extraction ───────────────────────────────────────────────────────
export function extractMetadata(_path) {
  return { duration: 0, fileType: 'audio', chapters: [], audioStreams: [], subtitleStreams: [] };
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────
export function generateThumbnail(_path, _timeSeconds, _outputPath) {
  throw new Error('[zovyra-native stub] generateThumbnail() requires the native build.');
}

// ── Folder scanning ───────────────────────────────────────────────────────────
export function scanFolders(folders) {
  const results = [];
  for (const folder of folders) {
    try {
      const stat = statSync(folder);
      if (stat.isDirectory()) results.push({ path: folder, mtime: Date.now(), size: 0 });
    } catch { /* ignore */ }
  }
  return results;
}

// ── Waveform / fingerprinting ─────────────────────────────────────────────────
export function generateWaveform(_path) { return new Array(1000).fill(0); }
export function generateWaveformFingerprint(_path) { return '00'.repeat(32); }
export function generateFingerprint(_path) { return { fingerprint: '', duration: 0 }; }

// ── Subtitles ─────────────────────────────────────────────────────────────────
export function getSubtitleTracks(_path) { return []; }
export function extractSubtitleStream(_path, _streamIndex) {
  throw new Error('[zovyra-native stub] extractSubtitleStream() requires the native build.');
}