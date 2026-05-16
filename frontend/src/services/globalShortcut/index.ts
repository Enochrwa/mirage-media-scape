import { getPlatform } from '../../platform';
import { WebGlobalShortcutService } from './WebGlobalShortcutService';
import { TauriGlobalShortcutService } from './TauriGlobalShortcutService';
import { CapacitorGlobalShortcutService } from './CapacitorGlobalShortcutService';
import type { IGlobalShortcutService } from './IGlobalShortcutService';

let _instance: IGlobalShortcutService | null = null;

export function getGlobalShortcutService(): IGlobalShortcutService {
  if (_instance) return _instance;
  const { host } = getPlatform();
  if (host === 'desktop') {
    _instance = new TauriGlobalShortcutService();
  } else if (host === 'mobile') {
    _instance = new CapacitorGlobalShortcutService();
  } else {
    _instance = new WebGlobalShortcutService();
  }
  return _instance;
}
