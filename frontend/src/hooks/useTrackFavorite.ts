import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_BASE } from '@/lib/utils';

/**
 * Persisted, server-backed favorite/like status for a single track.
 *
 * Replaces the old pattern (MiniPlayer/FullNowPlaying each kept their own
 * `useState(false)` for "isFavorite") which never read the track's actual
 * favorite status and never persisted a click anywhere — every reload or
 * track change silently reset to "not favorited", even for tracks the user
 * had already favorited. This hook is the single source of truth both
 * components read from and write through, backed by the `track_likes`
 * table via `/api/social/tracks/:id/liked` and `/api/social/tracks/:id/like`.
 *
 * Radio stations have their own, separate favorites system
 * (`/api/radio/favorites`, keyed by stationuuid) — pass `undefined` or a
 * stream track's id here only if you actually want it treated as a normal
 * track; callers should generally gate this hook behind `!isStream`.
 */
export function useTrackFavorite(trackId: string | undefined) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  // Guards against a slow /liked response for a previous track clobbering
  // the state after the user has already navigated to a new one.
  const requestedIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    requestedIdRef.current = trackId;
    if (!trackId) {
      setIsFavorite(false);
      setIsLoaded(false);
      return;
    }
    setIsLoaded(false);
    axios
      .get(`${API_BASE}/api/social/tracks/${trackId}/liked`)
      .then((res) => {
        if (requestedIdRef.current !== trackId) return;
        setIsFavorite(Boolean(res.data?.liked));
      })
      .catch(() => {
        if (requestedIdRef.current !== trackId) return;
        setIsFavorite(false);
      })
      .finally(() => {
        if (requestedIdRef.current === trackId) setIsLoaded(true);
      });
  }, [trackId]);

  const toggle = useCallback(async () => {
    if (!trackId) return;
    const optimistic = !isFavorite;
    setIsFavorite(optimistic);
    try {
      const res = await axios.post(`${API_BASE}/api/social/tracks/${trackId}/like`);
      const serverLiked = Boolean(res.data?.liked);
      if (requestedIdRef.current === trackId) setIsFavorite(serverLiked);
    } catch {
      // Revert on failure rather than leaving the UI showing a state that
      // was never actually persisted.
      if (requestedIdRef.current === trackId) setIsFavorite(!optimistic);
    }
  }, [trackId, isFavorite]);

  return { isFavorite, isLoaded, toggle };
}
