import { getPlatform } from '../../platform';
import { WebNotificationService } from './WebNotificationService';
import { TauriNotificationService } from './TauriNotificationService';
import { CapacitorNotificationService } from './CapacitorNotificationService';
import type { INotificationService } from './INotificationService';

let _instance: INotificationService | null = null;

export function getNotificationService(): INotificationService {
  if (_instance) return _instance;
  const { host } = getPlatform();
  if (host === 'desktop') {
    _instance = new TauriNotificationService();
  } else if (host === 'mobile') {
    _instance = new CapacitorNotificationService();
  } else {
    _instance = new WebNotificationService();
  }
  return _instance;
}
