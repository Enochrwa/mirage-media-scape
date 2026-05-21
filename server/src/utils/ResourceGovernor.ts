import os from 'os';

export class ResourceGovernor {
  shouldPauseAnalysis(): boolean {
    const freeMB = os.freemem() / 1024 / 1024;
    const load = os.loadavg()[0]; // 1-minute load average
    const cores = os.cpus().length;

    // Pause if less than 150 MB free OR CPU load > 90% of capacity
    return freeMB < 150 || load / cores > 0.9;
  }

  delayBetweenTracks(): number {
    const freeMB = os.freemem() / 1024 / 1024;
    const load = os.loadavg()[0];
    const cores = os.cpus().length;
    const cpuPressure = load / cores;

    let delay = 50; // default

    if (freeMB < 300 || cpuPressure > 0.8) delay = 2000;
    else if (freeMB < 600 || cpuPressure > 0.5) delay = 500;
    else if (freeMB < 1200 || cpuPressure > 0.3) delay = 100;

    return delay;
  }
}
