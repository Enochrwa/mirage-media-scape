import { getPlatform } from '../../platform';
import { WebDialogService } from './WebDialogService';
import { TauriDialogService } from './TauriDialogService';
import { CapacitorDialogService } from './CapacitorDialogService';
import type { IDialogService } from './IDialogService';

let _instance: IDialogService | null = null;

export function getDialogService(): IDialogService {
  if (_instance) return _instance;
  const { host } = getPlatform();
  if (host === 'desktop') {
    _instance = new TauriDialogService();
  } else if (host === 'mobile') {
    _instance = new CapacitorDialogService();
  } else {
    _instance = new WebDialogService();
  }
  return _instance;
}
