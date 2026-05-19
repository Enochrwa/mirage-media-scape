import os from 'os';

export class ResourceGovernor {
  shouldPauseAnalysis(): boolean {
    const freeMB = os.freemem() / 1024 / 1024;
    // Pause if less than 150 MB free
    return freeMB < 150;
  }

  delayBetweenTracks(): number {
    const freeMB = os.freemem() / 1024 / 1024;
    if (freeMB < 300) return 2000; // 2 seconds on very low RAM
    if (freeMB < 600) return 500;  // 500ms on low RAM
    if (freeMB < 1200) return 100; // 100ms on medium RAM
    return 50;                      // 50ms on high RAM
  }
}
