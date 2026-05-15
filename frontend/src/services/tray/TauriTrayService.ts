import type { ITrayService } from './ITrayService'
import { TrayIcon } from '@tauri-apps/api/tray'

export class TauriTrayService implements ITrayService {
  async updateStatus(isPlaying: boolean): Promise<void> {
    const tray = await TrayIcon.getById('main')
    if (tray) {
      const menu = await tray.menu()
      if (menu) {
          const playItem = await menu.get('play')
          if (playItem) {
              await playItem.setText(isPlaying ? 'Pause' : 'Play')
          }
      }
    }
  }

  async showMiniPlayer(): Promise<void> {
    // In Tauri, we might have a separate small window or just show the main window
  }
}
