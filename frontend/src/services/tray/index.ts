import { getPlatform } from '../../platform';
import { WebTrayService } from './WebTrayService';
import { TauriTrayService } from './TauriTrayService';
import { CapacitorTrayService } from './CapacitorTrayService';
import type { ITrayService } from './ITrayService';

let _instance: ITrayService | null = null;

export function getTrayService(): ITrayService {
  if (_instance) return _instance;
  const { host } = getPlatform();
  if (host === 'desktop') {
    _instance = new TauriTrayService();
  } else if (host === 'mobile') {
    _instance = new CapacitorTrayService();
  } else {
    _instance = new WebTrayService();
  }
  return _instance;
}
