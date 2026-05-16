import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { IHapticsService } from './IHapticsService';

export class CapacitorHapticsService implements IHapticsService {
  async impact(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: map[style] });
  }

  async vibrate(): Promise<void> {
    await Haptics.vibrate();
  }

  async selection(): Promise<void> {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  }
}
