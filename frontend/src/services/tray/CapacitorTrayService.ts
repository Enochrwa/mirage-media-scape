import type { ITrayService } from './ITrayService';

export class CapacitorTrayService implements ITrayService {
  async updateStatus(_isPlaying: boolean): Promise<void> {
    // Mobile doesn't have a system tray in the desktop sense.
    // Media controls are handled via the lock screen / notification shade.
  }

  async showMiniPlayer(): Promise<void> {
    // No-op on mobile
  }
}
