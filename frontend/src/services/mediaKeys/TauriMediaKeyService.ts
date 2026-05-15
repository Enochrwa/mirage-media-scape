import type { IMediaKeyService } from './IMediaKeyService'
import { MediaFile } from '@/types/media'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

export class TauriMediaKeyService implements IMediaKeyService {
  async updateMetadata(file: MediaFile): Promise<void> {
    await invoke('update_media_metadata', {
      title: file.title,
      artist: file.artist,
      album: file.album,
    })
  }

  async setActionHandlers(handlers: {
    play: () => void
    pause: () => void
    next: () => void
    previous: () => void
    seek?: (time: number) => void
  }): Promise<void> {
    // Listen for events from Rust (tray or global shortcuts)
    await listen('tray-play-pause', () => {
      handlers.play()
    })
    await listen('tray-next', () => {
      handlers.next()
    })
    await listen('tray-prev', () => {
      handlers.previous()
    })
  }
}
