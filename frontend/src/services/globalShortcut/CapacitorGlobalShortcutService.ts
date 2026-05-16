import type { IGlobalShortcutService } from './IGlobalShortcutService';
import { App } from '@capacitor/app';

export class CapacitorGlobalShortcutService implements IGlobalShortcutService {
  async register(_shortcut: string, _handler: () => void): Promise<void> {
    // Mobile OS doesn't support global shortcuts in the same way as desktop.
    // We could potentially use physical volume buttons, but that's out of scope for standard Capacitor.
    console.warn('[CapacitorGlobalShortcut] Global shortcuts not supported on mobile');
  }

  async unregister(_shortcut: string): Promise<void> {
    // No-op
  }
}
