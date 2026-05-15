import { getPlatform } from '../../platform';
import { WebOfflineCacheService } from './WebOfflineCacheService';
import { TauriOfflineCacheService } from './TauriOfflineCacheService';
import type { IOfflineCacheService } from './IOfflineCacheService';

let _instance: IOfflineCacheService | null = null;

export function getOfflineCacheService(): IOfflineCacheService {
  if (_instance) return _instance;
  _instance =
    getPlatform().host === 'desktop'
      ? new TauriOfflineCacheService()
      : new WebOfflineCacheService();
  return _instance;
}
