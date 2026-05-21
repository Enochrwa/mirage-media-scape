/**
 * frontend/src/engines/ResourceMonitor.ts
 *
 * Consolidated ResourceMonitor that tracks battery, FPS, and hardware
 * to determine the optimal resource state for the application.
 */

export type ResourceState = 'normal' | 'low-power' | 'critical';

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
}

interface NavigatorExtended extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
  deviceMemory?: number;
}

export class ResourceMonitor {
  private static instance: ResourceMonitor;
  private state: ResourceState = 'normal';
  private fps: number = 60;
  private listeners: Set<(state: ResourceState) => void> = new Set();
  private battery: BatteryManager | null = null;

  private constructor() {
    this.initBattery();
    this.monitorHardware();
    this.monitorFPS();
  }

  static getInstance(): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor();
    }
    return ResourceMonitor.instance;
  }

  private async initBattery(): Promise<void> {
    if (typeof window === 'undefined') return;

    const nav = navigator as NavigatorExtended;
    if (nav.getBattery) {
      try {
        this.battery = await nav.getBattery();
        const check = () => this.evaluate();
        this.battery.addEventListener('levelchange', check);
        this.battery.addEventListener('chargingchange', check);
        check();
      } catch (e) {
        console.warn('Battery API not available:', e);
      }
    }
  }

  private monitorHardware(): void {
    if (typeof navigator === 'undefined') return;

    const nav = navigator as NavigatorExtended;
    const cores = nav.hardwareConcurrency || 4;
    const memory = nav.deviceMemory || 4;
    if (cores <= 2 || memory <= 1) {
      this.evaluate();
    }
  }

  private monitorFPS(): void {
    if (typeof window === 'undefined') return;

    let lastTime = performance.now();
    let lastFrameTime = 0;

    const loop = (time: number) => {
      if (lastFrameTime) {
        const delta = time - lastFrameTime;
        if (delta > 0) {
          const currentFPS = 1000 / delta;
          this.fps = this.fps * 0.95 + currentFPS * 0.05;
        }
      }
      lastFrameTime = time;

      const now = performance.now();
      if (now - lastTime >= 2000) {
        this.evaluate();
        lastTime = now;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private evaluate(): void {
    let newState: ResourceState = 'normal';

    // 1. Hardware Check
    const nav = (typeof navigator !== 'undefined' ? navigator : {}) as NavigatorExtended;
    const cores = nav.hardwareConcurrency || 4;
    const memory = nav.deviceMemory || 4;

    if (cores <= 2 || memory <= 1) {
      newState = 'low-power';
    }

    // 2. Battery Check
    if (this.battery) {
      const { level, charging } = this.battery;
      if (level < 0.1 && !charging) {
        newState = 'critical';
      } else if (level < 0.2 && !charging) {
        newState = 'low-power';
      }
    }

    // 3. FPS Check
    if (this.fps < 20) {
      newState = 'critical';
    } else if (this.fps < 35) {
      if (newState !== 'critical') newState = 'low-power';
    }

    if (this.state !== newState) {
      this.state = newState;
      this.listeners.forEach((fn) => fn(newState));
      window.dispatchEvent(
        new CustomEvent('lowpowerchange', {
          detail: newState === 'low-power' || newState === 'critical',
        }),
      );
    }
  }

  public getState(): ResourceState {
    return this.state;
  }

  public isLowPowerMode(): boolean {
    return this.state === 'low-power' || this.state === 'critical';
  }

  public getFPS(): number {
    return Math.round(this.fps);
  }

  public subscribe(fn: (state: ResourceState) => void): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }
}

// Export a singleton for easier use
export const resourceMonitor = ResourceMonitor.getInstance();
