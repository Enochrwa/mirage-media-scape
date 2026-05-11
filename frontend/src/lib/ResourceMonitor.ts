export type ResourceState = 'normal' | 'low-power' | 'critical';

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  onchargingchange: ((this: BatteryManager, ev: Event) => void) | null;
  onchargingtimechange: ((this: BatteryManager, ev: Event) => void) | null;
  ondischargingtimechange: ((this: BatteryManager, ev: Event) => void) | null;
  onlevelchange: ((this: BatteryManager, ev: Event) => void) | null;
}

export class ResourceMonitor {
  private battery: BatteryManager | null = null;
  private lastFrameTime: number = 0;
  private fps: number = 60;
  private state: ResourceState = 'normal';
  private listeners: ((state: ResourceState) => void)[] = [];

  constructor() {
    this.initBattery();
    this.startFPSMonitor();
  }

  private async initBattery() {
    const nav = navigator as unknown as { getBattery?: () => Promise<BatteryManager> };
    if (typeof window !== 'undefined' && typeof nav.getBattery === 'function') {
      try {
        this.battery = await nav.getBattery();
        this.battery.addEventListener('levelchange', () => this.evaluate());
        this.battery.addEventListener('chargingchange', () => this.evaluate());
        this.evaluate();
      } catch (e) {
        console.error('Battery API error:', e);
      }
    }
  }

  private startFPSMonitor() {
    if (typeof window === 'undefined') return;

    const check = (time: number) => {
      if (this.lastFrameTime) {
        const delta = time - this.lastFrameTime;
        if (delta > 0) {
          const currentFPS = 1000 / delta;
          // Simple EMA for FPS
          this.fps = this.fps * 0.95 + currentFPS * 0.05;
        }
      }
      this.lastFrameTime = time;

      // Re-evaluate every 2 seconds (roughly 120 frames)
      if (Math.round(time / 2000) !== Math.round((this.lastFrameTime - 16) / 2000)) {
        this.evaluate();
      }

      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  private evaluate() {
    let newState: ResourceState = 'normal';

    const batteryLevel = this.battery ? this.battery.level : 1;
    const isCharging = this.battery ? this.battery.charging : true;

    if (batteryLevel < 0.1 && !isCharging) {
      newState = 'critical';
    } else if ((batteryLevel < 0.2 && !isCharging) || this.fps < 30) {
      newState = 'low-power';
    }

    if (newState !== this.state) {
      this.state = newState;
      this.notify();
    }
  }

  public subscribe(callback: (state: ResourceState) => void) {
    this.listeners.push(callback);
    callback(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.state));
  }

  public getState() {
    return this.state;
  }

  public getFPS() {
    return Math.round(this.fps);
  }
}

export const resourceMonitor = new ResourceMonitor();
