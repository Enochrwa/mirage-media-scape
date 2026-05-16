import { getPlatform } from '../../platform';
import { WebFileAccessService } from './WebFileAccessService';
import { TauriFileAccessService } from './TauriFileAccessService';
import type { IFileAccessService } from './IFileAccessService';

let _instance: IFileAccessService | null = null;

export function getFileAccessService(): IFileAccessService {
  if (_instance) return _instance;
  _instance =
    getPlatform().host === 'desktop' ? new TauriFileAccessService() : new WebFileAccessService();
  return _instance;
}
