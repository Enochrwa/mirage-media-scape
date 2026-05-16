import type { IGlobalShortcutService } from './IGlobalShortcutService';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';

export class TauriGlobalShortcutService implements IGlobalShortcutService {
  async register(shortcut: string, handler: () => void): Promise<void> {
    await register(shortcut, handler);
  }

  async unregister(shortcut: string): Promise<void> {
    await unregister(shortcut);
  }
}
