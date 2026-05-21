import { useState, useEffect } from 'react';

export interface CodecSupport {
  h264: boolean;
  hevc: boolean;
  av1: boolean;
  vp9: boolean;
}

export async function checkHardwareSupport(): Promise<CodecSupport> {
  const support: CodecSupport = {
    h264: false,
    hevc: false,
    av1: false,
    vp9: false,
  };

  if (typeof VideoDecoder === 'undefined') return support;

  const codecs: Record<string, keyof CodecSupport> = {
    'avc1.4d2015': 'h264',
    'hev1.1.6.L93.B0': 'hevc',
    'av01.0.05M.08': 'av1',
    'vp09.00.10.08': 'vp9',
  };

  for (const [codec, key] of Object.entries(codecs)) {
    const config: VideoDecoderConfig = {
      codec,
      codedWidth: 1920,
      codedHeight: 1080,
      hardwareAcceleration: 'prefer-hardware',
    };

    try {
      const res = await VideoDecoder.isConfigSupported(config);
      if (res.supported && res.config?.hardwareAcceleration === 'prefer-hardware') {
        support[key] = true;
      }
    } catch (e) {
      // Fallback or ignore
    }
  }

  return support;
}

export function useHardwareDecoding() {
  const [hwSupport, setHwSupport] = useState<CodecSupport>({
    h264: false,
    hevc: false,
    av1: false,
    vp9: false,
  });

  useEffect(() => {
    checkHardwareSupport().then(setHwSupport);
  }, []);

  return hwSupport;
}
