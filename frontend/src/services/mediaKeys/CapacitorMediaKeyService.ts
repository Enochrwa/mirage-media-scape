import { MediaSession } from '@capgo/capacitor-media-session';
import type { IMediaKeyService } from './IMediaKeyService';
import { MediaFile } from '@/types/media';

/**
 * Mobile (Capacitor) implementation of media key / lock-screen controls.
 *
 * The Android WebView does not implement the Media Session Web API
 * (navigator.mediaSession), so WebMediaKeyService silently no-ops on Android.
 * This service uses @capgo/capacitor-media-session instead, which bridges to:
 *   - Android: androidx.media MediaSessionCompat (notification shade + lock screen)
 *   - iOS: MPNowPlayingInfoCenter / MPRemoteCommandCenter (Control Center + lock screen)
 *
 * Note: setPlaybackState must be called whenever playback starts/pauses, or the
 * OS will not display the notification at all (see updatePlaybackState below).
 */
export class CapacitorMediaKeyService implements IMediaKeyService {
  async updateMetadata(file: MediaFile): Promise<void> {
    try {
      await MediaSession.setMetadata({
        title: file.title ?? 'Unknown Title',
        artist: file.artist ?? 'Unknown Artist',
        album: file.album ?? undefined,
        artwork: file.cover
          ? [
              {
                src: file.cover,
                sizes: '512x512',
                type: 'image/jpeg',
              },
            ]
          : [],
      });
    } catch (e) {
      console.warn('[CapacitorMediaKeyService] Failed to set metadata', e);
    }
  }

  /**
   * Must be called on every play/pause transition. Without this, the OS will not
   * surface the notification / lock-screen controls at all.
   */
  async updatePlaybackState(state: 'playing' | 'paused' | 'none'): Promise<void> {
    try {
      await MediaSession.setPlaybackState({ playbackState: state });
    } catch (e) {
      console.warn('[CapacitorMediaKeyService] Failed to set playback state', e);
    }
  }

  async updatePositionState(position: number, duration: number, playbackRate = 1): Promise<void> {
    try {
      await MediaSession.setPositionState({ position, duration, playbackRate });
    } catch (e) {
      // Non-fatal — scrubber on lock screen just won't be accurate this tick.
    }
  }

  async setActionHandlers(handlers: {
    play: () => void;
    pause: () => void;
    next: () => void;
    previous: () => void;
    seek?: (time: number) => void;
  }): Promise<void> {
    try {
      await MediaSession.setActionHandler({ action: 'play' }, () => handlers.play());
      await MediaSession.setActionHandler({ action: 'pause' }, () => handlers.pause());
      await MediaSession.setActionHandler({ action: 'nexttrack' }, () => handlers.next());
      await MediaSession.setActionHandler({ action: 'previoustrack' }, () => handlers.previous());

      if (handlers.seek) {
        await MediaSession.setActionHandler({ action: 'seekto' }, (details) => {
          if (details.seekTime != null) {
            handlers.seek!(details.seekTime);
          }
        });
      }
    } catch (e) {
      console.warn('[CapacitorMediaKeyService] Failed to register action handlers', e);
    }
  }
}
