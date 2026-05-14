// Stub native module for development without FFmpeg
// This allows the server to start but with limited functionality

const path = require('path');

const stub = {
  extractMetadata: () => ({ duration: 0, fileType: 'audio' }),
  generateThumbnail: () => {},
  getSubtitleTracks: () => [],
  writeTags: () => { throw new Error('Not implemented'); },
  probeHardwareCodecs: () => ({ h264: true, hevc: true, av1: false, vp9: true }),
  extractSubtitleStream: () => '',
  analyzeAudio: () => ({ bpm: 0, key: 'C', camelotKey: '1A', energy: 0, loudness: -96 }),
  computeReplayGain: () => [],
  generateWaveform: () => new Array(1000).fill(0),
  generateWaveformFingerprint: () => '00'.repeat(32),
  generateFingerprint: () => ({ fingerprint: '', duration: 0 }),
  scanFolders: (folders) => {
    const results = [];
    for (const folder of folders) {
      try {
        const fs = require('fs');
        const stat = fs.statSync(folder);
        if (stat.isDirectory()) {
          results.push({ path: folder, mtime: Date.now(), size: 0 });
        }
      } catch (e) {}
    }
    return results;
  },
};

module.exports = stub;