import type { IMediaKeyService } from './IMediaKeyService'
import { MediaFile } from '@/types/media'

export class WebMediaKeyService implements IMediaKeyService {
  async updateMetadata(file: MediaFile): Promise<void> {
    if (!('mediaSession' in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: file.title,
      artist: file.artist,
      album: file.album,
      artwork: file.cover
        ? [
            {
              src: file.cover,
              sizes: '512x512',
              type: 'image/jpeg',
            },
          ]
        : [],
    })
  }

  async setActionHandlers(handlers: {
    play: () => void
    pause: () => void
    next: () => void
    previous: () => void
    seek?: (time: number) => void
  }): Promise<void> {
    if (!('mediaSession' in navigator)) return

    navigator.mediaSession.setActionHandler('play', handlers.play)
    navigator.mediaSession.setActionHandler('pause', handlers.pause)
    navigator.mediaSession.setActionHandler('nexttrack', handlers.next)
    navigator.mediaSession.setActionHandler('previoustrack', handlers.previous)
    if (handlers.seek) {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          handlers.seek!(details.seekTime)
        }
      })
    }
  }
}
