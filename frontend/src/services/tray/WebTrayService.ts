import type { ITrayService } from './ITrayService'

export class WebTrayService implements ITrayService {
  async updateStatus(_isPlaying: boolean): Promise<void> {
    // No tray in web, maybe update favicon or title
  }

  async showMiniPlayer(): Promise<void> {
    // Show floating overlay in UI
    window.dispatchEvent(new CustomEvent('zovyra-show-miniplayer'))
  }
}
