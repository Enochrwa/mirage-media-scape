export class ResourceMonitor {
  private static instance: ResourceMonitor;
  private isLowPower: boolean = false;
  private listeners: Set<(lowPower: boolean) => void> = new Set();

  private constructor() {
    this.monitorBattery();
    this.monitorHardware();
    this.monitorFPS();
  }

  static getInstance(): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor();
    }
    return ResourceMonitor.instance;
  }

  private async monitorBattery(): Promise<void> {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as unknown as { getBattery: () => Promise<{ level: number; charging: boolean; addEventListener: (type: string, listener: () => void) => void }> }).getBattery();
        const check = () => {
          const lowBattery = battery.level < 0.2 && !battery.charging;
          this.updateState(lowBattery);
        };
        battery.addEventListener('levelchange', check);
        battery.addEventListener('chargingchange', check);
        check();
      } catch (e) {
        console.warn('Battery API not available:', e);
      }
    }
  }

  private monitorHardware(): void {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
    if (cores <= 2 || memory <= 1) {
      this.updateState(true); // Permanent low-power for this device
    }
  }

  private monitorFPS(): void {
    let frames = 0;
    let lastTime = performance.now();
    let consecutiveLowWindows = 0;

    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 2000) {
        const fps = frames / ((now - lastTime) / 1000);
        if (fps < 20) {
          consecutiveLowWindows++;
          if (consecutiveLowWindows >= 2) this.updateState(true);
        } else if (fps > 40) {
          consecutiveLowWindows = 0;
          this.updateState(false);
        }
        frames = 0;
        lastTime = now;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private updateState(lowPower: boolean): void {
    if (this.isLowPower !== lowPower) {
      this.isLowPower = lowPower;
      this.listeners.forEach(fn => fn(lowPower));
      window.dispatchEvent(new CustomEvent('lowpowerchange', { detail: lowPower }));
    }
  }

  isLowPowerMode(): boolean { return this.isLowPower; }

  subscribe(fn: (lowPower: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
