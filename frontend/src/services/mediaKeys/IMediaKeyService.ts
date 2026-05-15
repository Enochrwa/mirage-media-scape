import { MediaFile } from '@/types/media'

export interface IMediaKeyService {
  updateMetadata(file: MediaFile): Promise<void>
  setActionHandlers(handlers: {
    play: () => void
    pause: () => void
    next: () => void
    previous: () => void
    seek?: (time: number) => void
  }): Promise<void>
}
