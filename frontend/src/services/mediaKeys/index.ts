import { getPlatform } from '../../platform';
import { WebMediaKeyService } from './WebMediaKeyService';
import { TauriMediaKeyService } from './TauriMediaKeyService';
import type { IMediaKeyService } from './IMediaKeyService';

export type { IMediaKeyService };

let _instance: IMediaKeyService | null = null;

export function getMediaKeyService(): IMediaKeyService {
  if (_instance) return _instance;
  const { host } = getPlatform();
  if (host === 'desktop') {
    _instance = new TauriMediaKeyService();
  } else if (host === 'mobile') {
    // On mobile Capacitor, we use the standard Media Session API
    // which is already implemented in WebMediaKeyService.
    _instance = new WebMediaKeyService();
  } else {
    _instance = new WebMediaKeyService();
  }
  return _instance;
}
