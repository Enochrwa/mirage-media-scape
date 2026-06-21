import { getPlatform } from '../../platform';
import { WebMediaKeyService } from './WebMediaKeyService';
import { TauriMediaKeyService } from './TauriMediaKeyService';
import { CapacitorMediaKeyService } from './CapacitorMediaKeyService';
import type { IMediaKeyService } from './IMediaKeyService';

export type { IMediaKeyService };

let _instance: IMediaKeyService | null = null;

export function getMediaKeyService(): IMediaKeyService {
  if (_instance) return _instance;
  const { host } = getPlatform();
  if (host === 'desktop') {
    _instance = new TauriMediaKeyService();
  } else if (host === 'mobile') {
    // The Android WebView does not implement navigator.mediaSession, so the
    // Web Media Session API silently does nothing there. Use the native
    // Capacitor plugin instead for real lock-screen / notification controls.
    _instance = new CapacitorMediaKeyService();
  } else {
    _instance = new WebMediaKeyService();
  }
  return _instance;
}
