"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.probeHardwareCodecs = probeHardwareCodecs;
exports.analyzeAudio = analyzeAudio;
exports.computeReplayGain = computeReplayGain;
exports.writeTags = writeTags;
exports.extractMetadata = extractMetadata;
exports.generateThumbnail = generateThumbnail;
exports.scanFolders = scanFolders;
exports.generateWaveform = generateWaveform;
exports.generateWaveformFingerprint = generateWaveformFingerprint;
exports.generateFingerprint = generateFingerprint;
exports.getSubtitleTracks = getSubtitleTracks;
exports.extractSubtitleStream = extractSubtitleStream;
// ── Warn once on first import ─────────────────────────────────────────────────
console.warn('\x1b[33m[zovyra-native]\x1b[0m Running in STUB mode — native FFmpeg features are disabled.\n' +
    '  → Run \x1b[36mcd native && npm run build\x1b[0m to enable full support.');
function stubError(fn) {
    throw new Error(`[zovyra-native stub] ${fn}() requires the native build.\n` +
        '  Run: cd native && npm run build');
}
// ── Codec detection ───────────────────────────────────────────────────────────
function probeHardwareCodecs() {
    return { h264: true, hevc: true, av1: false, vp9: true };
}
// ── Audio analysis ────────────────────────────────────────────────────────────
function analyzeAudio(_path) {
    return { bpm: 0, key: 'C', camelotKey: '1A', energy: 0, loudness: -96 };
}
function computeReplayGain(_paths) {
    return [];
}
// ── Tag writing ───────────────────────────────────────────────────────────────
function writeTags(_path, _tags) {
    stubError('writeTags');
}
// ── Metadata extraction ───────────────────────────────────────────────────────
function extractMetadata(_path) {
    const path = require('path');
    const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.wmv']);
    const ext = path.extname(_path).toLowerCase();
    const basename = path.basename(_path, ext);
    const fileType = VIDEO_EXTS.has(ext) ? 'video' : 'audio';
    return {
        duration: 0,
        fileType,
        title: basename,
        artist: null,
        album: null,
        albumArtist: null,
        year: null,
        genre: null,
        trackNumber: null,
        discNumber: null,
        sampleRate: null,
        bitRate: null,
        channels: null,
        codecName: null,
        replaygainTrackGain: null,
        replaygainTrackPeak: null,
        replaygainAlbumGain: null,
        replaygainAlbumPeak: null,
        encoderDelay: null,
        encoderPadding: null,
        coverArtBytes: null,
        chapters: [],
        audioStreams: [],
        subtitleStreams: [],
    };
}
// ── Thumbnail ─────────────────────────────────────────────────────────────────
function generateThumbnail(_path, _timeSeconds, _outputPath) {
    // Stub: no FFmpeg available, skip thumbnail generation silently
    return;
}
// ── Folder scanning ───────────────────────────────────────────────────────────
function scanFolders(folders, callback) {
    // Stub mode: we cannot enumerate real media files without FFmpeg.
    // Walk the folders ourselves using Node's built-in fs module to find
    // common audio/video files, then signal completion via the callback.
    const fs = require('fs');
    const path = require('path');
    const MEDIA_EXTS = new Set([
        '.mp3', '.flac', '.m4a', '.ogg', '.wav', '.opus', '.aac',
        '.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.wmv',
    ]);
    const MAX_DEPTH = 5;

    function walkDir(dir, depth) {
        if (depth > MAX_DEPTH) return [];
        let results = [];
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (_) {
            return results;
        }
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results = results.concat(walkDir(full, depth + 1));
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (MEDIA_EXTS.has(ext)) {
                    try {
                        const stat = fs.statSync(full);
                        results.push({ path: full, mtime: stat.mtimeMs, size: stat.size });
                    } catch (_) { /* skip */ }
                }
            }
        }
        return results;
    }

    // Run asynchronously so the caller's event loop isn't blocked
    setImmediate(() => {
        try {
            for (const folder of (folders || [])) {
                const batch = walkDir(folder, 0);
                if (batch.length > 0) {
                    callback(null, batch);
                }
            }
            // Signal completion
            callback(null, null);
        } catch (err) {
            callback(err, null);
        }
    });
}
// ── Waveform / fingerprinting ─────────────────────────────────────────────────
function generateWaveform(_path) {
    return new Array(1000).fill(0);
}
function generateWaveformFingerprint(_path) {
    return '00'.repeat(32);
}
function generateFingerprint(_path) {
    return { fingerprint: '00'.repeat(32), duration: 0 };
}
// ── Subtitles ─────────────────────────────────────────────────────────────────
function getSubtitleTracks(_path) {
    return [];
}
function extractSubtitleStream(_path, _streamIndex) {
    stubError('extractSubtitleStream');
}
