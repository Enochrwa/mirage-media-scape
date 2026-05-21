import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export function useHLSPlayback(videoRef: React.RefObject<HTMLVideoElement>, manifestUrl: string | null) {
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    if (!videoRef.current || !manifestUrl) return;

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        debug: false,
        maxMaxBufferLength: 30, // 30s buffer
        maxBufferLength: 10,
        abrEwmaFastLive: 3,
      });

      hls.loadSource(manifestUrl);
      hls.attachMedia(videoRef.current);
      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // For Safari which has native HLS support
      videoRef.current.src = manifestUrl;
    }
  }, [manifestUrl, videoRef]);

  return hlsRef.current;
}
