import type { IGlobalShortcutService } from './IGlobalShortcutService'

export class WebGlobalShortcutService implements IGlobalShortcutService {
  async register(_shortcut: string, _handler: () => void): Promise<void> {
    // Standard web browsers don't support global shortcuts outside the window
    // App.tsx handles window-level keydown events.
  }

  async unregister(_shortcut: string): Promise<void> {
  }
}
