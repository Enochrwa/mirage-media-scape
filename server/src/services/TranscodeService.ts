export type DeviceProfile = 'low' | 'mid' | 'high';

export class TranscodeService {
  static getBitrateConfig(profile: DeviceProfile) {
    const configs = {
      low: { audio: 128, video: 500, resolution: '640x360' },
      mid: { audio: 192, video: 2500, resolution: '1280x720' },
      high: { audio: 320, video: 5000, resolution: '1920x1080' },
    };
    return configs[profile] || configs.mid;
  }
}
