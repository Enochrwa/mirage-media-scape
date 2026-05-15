import { getPlatform } from '../../platform'
import { WebMediaKeyService } from './WebMediaKeyService'
import { TauriMediaKeyService } from './TauriMediaKeyService'
import type { IMediaKeyService } from './IMediaKeyService'

let _instance: IMediaKeyService | null = null

export function getMediaKeyService(): IMediaKeyService {
  if (_instance) return _instance
  _instance = getPlatform().host === 'desktop'
    ? new TauriMediaKeyService()
    : new WebMediaKeyService()
  return _instance
}
