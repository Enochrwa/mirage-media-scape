import { getPlatform } from '../../platform';
import { WebFileAccessService } from './WebFileAccessService';
import { TauriFileAccessService } from './TauriFileAccessService';
import { CapacitorFileAccessService } from './CapacitorFileAccessService';
import type { IFileAccessService } from './IFileAccessService';

let _instance: IFileAccessService | null = null;

export function getFileAccessService(): IFileAccessService {
  if (_instance) return _instance;
  const { host } = getPlatform();
  if (host === 'desktop') {
    _instance = new TauriFileAccessService();
  } else if (host === 'mobile') {
    _instance = new CapacitorFileAccessService();
  } else {
    _instance = new WebFileAccessService();
  }
  return _instance;
}
