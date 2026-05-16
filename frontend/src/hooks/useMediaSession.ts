import { useEffect } from 'react';
import { useCapability } from '../platform';
import { getMediaKeyService } from '../services/mediaKeys';
import { usePlayerStore } from '../store/usePlayerStore';

export function useMediaSession() {
  const canControl = useCapability('canControlMediaKeys');
  const { currentFile } = usePlayerStore();

  useEffect(() => {
    if (!canControl || !currentFile) return;

    getMediaKeyService().updateMetadata(currentFile);
  }, [currentFile, canControl]);

  useEffect(() => {
    if (!canControl) return;

    getMediaKeyService().setActionHandlers({
      play: () => usePlayerStore.getState().resumePlayback(),
      pause: () => usePlayerStore.getState().pausePlayback(),
      next: () => usePlayerStore.getState().nextTrack(),
      previous: () => usePlayerStore.getState().previousTrack(),
      seek: (time) => usePlayerStore.getState().seekTo(time),
    });
  }, [canControl]);
}
