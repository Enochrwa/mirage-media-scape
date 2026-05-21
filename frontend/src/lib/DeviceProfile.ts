export type DeviceProfile = 'low' | 'mid' | 'high';

export function detectDeviceProfile(): DeviceProfile {
  const ram = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 2;

  if (ram <= 2 && cores <= 2) return 'low';
  if (ram <= 4 && cores <= 4) return 'mid';
  return 'high';
}

export const CODEC_LADDER = {
  low: {
    audio: ['mp3', 'aac'],
    video: ['h264'],
  },
  mid: {
    audio: ['aac', 'vorbis', 'opus'],
    video: ['h264', 'vp9'],
  },
  high: {
    audio: ['aac', 'opus', 'flac'],
    video: ['h264', 'hevc', 'av1'],
  },
};

export const BITRATE_LADDER = {
  low: { audio: 128, video: 500, resolution: '640x360' },
  mid: { audio: 192, video: 2500, resolution: '1280x720' },
  high: { audio: 320, video: 5000, resolution: '1920x1080' },
};
