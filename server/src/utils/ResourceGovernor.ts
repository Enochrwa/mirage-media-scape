import os from 'os';

export class ResourceGovernor {
  // Check both RAM and CPU to determine if analysis should pause
  shouldPauseAnalysis(): boolean {
    const freeMB = os.freemem() / 1024 / 1024;
    
    // Pause if less than 150 MB free
    if (freeMB < 150) return true;
    
    // Also pause if CPU load is very high (single core at 80%+)
    // os.loadavg() returns [1min, 5min, 15min] average
    const loadAvg = os.loadavg()[0];  // 1-minute average
    const cpuCount = os.cpus().length;
    const loadPerCore = loadAvg / cpuCount;
    
    // If average load per core > 0.8, system is overloaded
    if (loadPerCore > 0.8) return true;
    
    return false;
  }

  delayBetweenTracks(): number {
    const freeMB = os.freemem() / 1024 / 1024;
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const loadPerCore = loadAvg / cpuCount;
    
    // Increase delay if either RAM is low OR CPU is high
    if (freeMB < 300 || loadPerCore > 0.7) return 2000; // 2 seconds on very low resources
    if (freeMB < 600 || loadPerCore > 0.5) return 500;  // 500ms on low resources
    if (freeMB < 1200 || loadPerCore > 0.3) return 100; // 100ms on medium resources
    return 50;                                       // 50ms on high resources
  }
}
