import { useEffect, useRef } from 'react';
import { useCapability } from '../platform';
import { getMediaKeyService } from '../services/mediaKeys';
import { usePlayerStore } from '../store/usePlayerStore';

export function useMediaSession() {
  const canControl = useCapability('canControlMediaKeys');
  const currentFile = usePlayerStore((state) => state.currentFile);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const lastPositionReportRef = useRef(0);

  useEffect(() => {
    if (!canControl || !currentFile) return;

    getMediaKeyService().updateMetadata(currentFile);
  }, [currentFile, canControl]);

  useEffect(() => {
    if (!canControl) return;

    getMediaKeyService().setActionHandlers({
      play: () => {
        if (usePlayerStore.getState().currentFile) {
          usePlayerStore.getState().resumePlayback();
        }
      },
      pause: () => {
        if (usePlayerStore.getState().currentFile) {
          usePlayerStore.getState().pausePlayback();
        }
      },
      next: () => {
        if (usePlayerStore.getState().currentFile) {
          usePlayerStore.getState().nextTrack();
        }
      },
      previous: () => {
        if (usePlayerStore.getState().currentFile) {
          usePlayerStore.getState().previousTrack();
        }
      },
      seek: (time) => {
        if (usePlayerStore.getState().currentFile) {
          usePlayerStore.getState().seekTo(time);
        }
      },
    });
  }, [canControl]);

  // Required on mobile: without reporting playback state, the OS will not show
  // the lock-screen / notification controls at all (no-op on desktop/web).
  useEffect(() => {
    if (!canControl || !currentFile) return;

    getMediaKeyService().updatePlaybackState?.(isPlaying ? 'playing' : 'paused');
  }, [canControl, currentFile, isPlaying]);

  // Throttled position reporting for the lock-screen scrubber — at most once/sec.
  useEffect(() => {
    if (!canControl || !currentFile) return;

    const unsubscribe = usePlayerStore.subscribe((state) => {
      const now = Date.now();
      if (now - lastPositionReportRef.current < 1000) return;
      lastPositionReportRef.current = now;

      getMediaKeyService().updatePositionState?.(state.currentTime, state.duration);
    });

    return unsubscribe;
  }, [canControl, currentFile]);
}
