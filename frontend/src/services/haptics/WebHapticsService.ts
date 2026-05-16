import type { IHapticsService } from './IHapticsService';

export class WebHapticsService implements IHapticsService {
  async impact(_style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
    // navigator.vibrate is often restricted or inconsistent across browsers
    // and explicitly forbidden by Zovyra security policy for some hosts.
  }

  async vibrate(): Promise<void> {
    // No-op to comply with Zovyra security policy
  }

  async selection(): Promise<void> {
    // No-op to comply with Zovyra security policy
  }
}
