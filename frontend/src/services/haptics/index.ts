import { getPlatform } from '../../platform';
import { WebHapticsService } from './WebHapticsService';
import { TauriHapticsService } from './TauriHapticsService';
import { CapacitorHapticsService } from './CapacitorHapticsService';
import type { IHapticsService } from './IHapticsService';

let _instance: IHapticsService | null = null;

export function getHapticsService(): IHapticsService {
  if (_instance) return _instance;
  const { host } = getPlatform();
  if (host === 'desktop') {
    _instance = new TauriHapticsService();
  } else if (host === 'mobile') {
    _instance = new CapacitorHapticsService();
  } else {
    _instance = new WebHapticsService();
  }
  return _instance;
}
