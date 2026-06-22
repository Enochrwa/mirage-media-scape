import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '@/lib/utils';
import { MediaFile } from '@/types/media';

const POLL_INTERVAL_MS = 15000;

/**
 * Live "now playing" title + connection-health state for a radio station
 * currently loaded into the player. Backed by:
 *  - GET /api/radio/now-playing — ICY metadata parsed server-side from the
 *    stream's interleaved StreamTitle frames (previously requested via
 *    `Icy-MetaData: 1` but never actually parsed or surfaced anywhere).
 *  - `zovyra-stream-buffering` / `zovyra-stream-recovered` — dispatched by
 *    PlaybackEngine when the <audio> element stalls/resumes, which for a
 *    live stream usually means the server-side proxy is mid-reconnect
 *    after the upstream Icecast/Shoutcast connection dropped.
 *
 * Returns null fields when `track` isn't a stream or has no station URL.
 */
export function useRadioNowPlaying(track: MediaFile | null) {
  const [nowPlayingTitle, setNowPlayingTitle] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const trackIdRef = useRef<string | undefined>(undefined);

  const isStream = Boolean(track?.isStream) || track?.album === 'Radio';
  const stationUrl = isStream ? track?.file : undefined;

  useEffect(() => {
    trackIdRef.current = track?.id;
    setNowPlayingTitle(null);
    setIsReconnecting(false);

    if (!stationUrl) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/radio/now-playing?url=${encodeURIComponent(stationUrl)}`,
        );
        const { data } = await res.json();
        if (cancelled || trackIdRef.current !== track?.id) return;
        setNowPlayingTitle(data?.title ?? null);
      } catch {
        // Now-playing is decorative — never surface this as a playback error.
      }
    };

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [stationUrl, track?.id]);

  useEffect(() => {
    if (!isStream) return;
    const onBuffering = () => setIsReconnecting(true);
    const onRecovered = () => setIsReconnecting(false);
    window.addEventListener('zovyra-stream-buffering', onBuffering);
    window.addEventListener('zovyra-stream-recovered', onRecovered);
    return () => {
      window.removeEventListener('zovyra-stream-buffering', onBuffering);
      window.removeEventListener('zovyra-stream-recovered', onRecovered);
    };
  }, [isStream]);

  return { nowPlayingTitle, isReconnecting };
}
