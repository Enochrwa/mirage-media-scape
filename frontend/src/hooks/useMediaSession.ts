import { useEffect } from 'react';
import { useCapability } from '../platform';
import { getMediaKeyService } from '../services/mediaKeys';
import { usePlayerStore } from '../store/usePlayerStore';

export function useMediaSession() {
  const canControl = useCapability('canControlMediaKeys');
  const currentFile = usePlayerStore((state) => state.currentFile);

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
}
