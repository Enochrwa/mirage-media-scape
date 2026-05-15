import type { IDialogService } from './IDialogService'
import { ask } from '@tauri-apps/plugin-dialog'

export class TauriDialogService implements IDialogService {
  async confirm(message: string, title?: string): Promise<boolean> {
    return await ask(message, { title, kind: 'warning' })
  }

  async prompt(message: string, defaultValue?: string): Promise<string | null> {
    // Tauri dialog doesn't have a simple prompt in the standard plugin
    // In a real app we might use a custom command or a web fallback
    return window.prompt(message, defaultValue)
  }
}
