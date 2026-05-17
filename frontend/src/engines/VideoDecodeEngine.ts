export class VideoDecodeEngine {
  static async probeHardwareDecode(): Promise<Record<string, boolean>> {
    const codecs = {
      h264: 'avc1.42001E', // H.264 Baseline
      hevc: 'hev1.1.6.L120.B0', // HEVC Main
      av1: 'av01.0.05M.08', // AV1 Main
      vp9: 'vp09.00.10.08', // VP9 Profile 0
    };

    const results: Record<string, boolean> = {
      h264: false,
      hevc: false,
      av1: false,
      vp9: false,
    };

    // Check for WebCodecs API
    if (!('VideoDecoder' in window)) {
      return results;
    }

    for (const [name, codec] of Object.entries(codecs)) {
      try {
        const config: VideoDecoderConfig = {
          codec,
          hardwareAcceleration: 'prefer-hardware',
        };
        const supported = await VideoDecoder.isConfigSupported(config);
        results[name] = !!supported.supported;
      } catch {
        results[name] = false;
      }
    }
    return results;
  }

  static detectHDR(videoTrack: { color_primaries?: number; color_transfer?: number }): {
    isHDR: boolean;
    type?: string;
  } {
    // Basic detection based on metadata if available
    if (videoTrack.color_primaries === 9) {
      // BT.2020
      if (videoTrack.color_transfer === 16) return { isHDR: true, type: 'HDR10 (PQ)' };
      if (videoTrack.color_transfer === 18) return { isHDR: true, type: 'HLG' };
    }
    return { isHDR: false };
  }
}
