import { MediaFile } from '@/types/media';

export interface IMediaKeyService {
  updateMetadata(file: MediaFile): Promise<void>;
  setActionHandlers(handlers: {
    play: () => void;
    pause: () => void;
    next: () => void;
    previous: () => void;
    seek?: (time: number) => void;
  }): Promise<void>;
  /**
   * Reports the current playback state to the OS. Required on mobile (Capacitor) —
   * without it, Android/iOS will not display the lock-screen / notification controls
   * at all. No-op on platforms where this isn't needed (desktop, plain web).
   */
  updatePlaybackState?(state: 'playing' | 'paused' | 'none'): Promise<void>;
  /**
   * Reports playback position for the OS scrubber (lock screen / Control Center).
   * Optional — platforms without a native scrubber can omit this.
   */
  updatePositionState?(position: number, duration: number, playbackRate?: number): Promise<void>;
}
