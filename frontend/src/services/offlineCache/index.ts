import { getPlatform } from '../../platform';
import { WebOfflineCacheService } from './WebOfflineCacheService';
import { TauriOfflineCacheService } from './TauriOfflineCacheService';
import { CapacitorOfflineCacheService } from './CapacitorOfflineCacheService';
import type { IOfflineCacheService } from './IOfflineCacheService';

let _instance: IOfflineCacheService | null = null;

export function getOfflineCacheService(): IOfflineCacheService {
  if (_instance) return _instance;
  const { host } = getPlatform();
  if (host === 'desktop') {
    _instance = new TauriOfflineCacheService();
  } else if (host === 'mobile') {
    _instance = new CapacitorOfflineCacheService();
  } else {
    _instance = new WebOfflineCacheService();
  }
  return _instance;
}
