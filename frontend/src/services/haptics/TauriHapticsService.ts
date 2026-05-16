import type { IHapticsService } from './IHapticsService';

export class TauriHapticsService implements IHapticsService {
  async impact(_style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
    // Desktop typically doesn't have haptics, but some laptops (MacBooks) might support it via private APIs
    // For now, no-op on desktop
  }

  async vibrate(): Promise<void> {
    // No-op on desktop
  }

  async selection(): Promise<void> {
    // No-op on desktop
  }
}
