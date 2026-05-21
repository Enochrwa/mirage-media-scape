import { useState, useEffect } from 'react';

export interface CodecSupport {
  h264: boolean;
  hevc: boolean;
  av1: boolean;
  vp9: boolean;
}

export function useHardwareDecoding() {
  const [hwSupport, setHwSupport] = useState<CodecSupport>({
    h264: false,
    hevc: false,
    av1: false,
    vp9: false,
  });

  useEffect(() => {
    if (typeof VideoDecoder === 'undefined') return;

    (async () => {
      const codecs: Record<string, keyof CodecSupport> = {
        'avc1.4d2015': 'h264',
        'hev1.1.6.L93.B0': 'hevc',
        'av01.0.05M.08': 'av1',
        'vp09.00.10.08': 'vp9',
      };

      const support: CodecSupport = { ...hwSupport };

      for (const [codec, key] of Object.entries(codecs)) {
        const config: VideoDecoderConfig = {
          codec,
          width: 1920,
          height: 1080,
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
      setHwSupport(support);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return hwSupport;
}
