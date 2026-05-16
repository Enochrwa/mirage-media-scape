import type { IMediaKeyService } from './IMediaKeyService';
import { MediaFile } from '@/types/media';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export class TauriMediaKeyService implements IMediaKeyService {
  async updateMetadata(file: MediaFile): Promise<void> {
    await invoke('update_media_metadata', {
      title: file.title || 'Unknown Title',
      artist: file.artist || 'Unknown Artist',
      album: file.album || 'Unknown Album',
    });
  }

  async setActionHandlers(handlers: {
    play: () => void;
    pause: () => void;
    next: () => void;
    previous: () => void;
    seek?: (time: number) => void;
  }): Promise<void> {
    // Listen for events from Rust (tray or global shortcuts)
    await listen('tray-play-pause', () => {
      // Toggle logic should be handled by the handler provider or here
      // For now we assume handlers.play/pause are provided and we can check state
      // but simpler is to have a single toggle handler.
      // Given the interface, we'll call play() and assume it handles resume
      handlers.play();
    });
    await listen('tray-next', () => {
      handlers.next();
    });
    await listen('tray-prev', () => {
      handlers.previous();
    });
  }
}
