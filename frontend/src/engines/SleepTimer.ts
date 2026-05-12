export class SleepTimer {
  private gainNode: GainNode;
  private audioCtx: AudioContext;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private mode: 'timer' | 'endOfTrack' | null = null;
  private endTime: number = 0;
  private onEndCallback: (() => void) | null = null;
  private pauseCallback: (() => void) | null = null;

  constructor(gainNode: GainNode, audioCtx: AudioContext, pauseCallback: () => void) {
    this.gainNode = gainNode;
    this.audioCtx = audioCtx;
    this.pauseCallback = pauseCallback;
  }

  set(minutes: number): void {
    this.clear();
    const totalMs = minutes * 60 * 1000;
    const fadeStartMs = Math.max(0, totalMs - 30000);

    this.mode = 'timer';
    this.endTime = Date.now() + totalMs;

    this.timerId = setTimeout(() => {
      // Start fading 30 seconds before the end
      this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 30);

      this.timerId = setTimeout(() => {
        this.pauseCallback?.();
        this.gainNode.gain.setTargetAtTime(1.0, this.audioCtx.currentTime, 0.1); // Reset gain
        this.clear();
        this.onEndCallback?.();
      }, 30500);
    }, fadeStartMs);
  }

  setEndOfTrack(onEndedEmitter: { addEventListener: (type: string, listener: () => void, options?: unknown) => void }): void {
    this.clear();
    this.mode = 'endOfTrack';
    const onEnded = () => {
      this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 30);
      setTimeout(() => {
        this.pauseCallback?.();
        this.gainNode.gain.setTargetAtTime(1.0, this.audioCtx.currentTime, 0.1);
        this.clear();
        this.onEndCallback?.();
      }, 30500);
    };
    onEndedEmitter.addEventListener('ended', onEnded, { once: true });
  }

  clear(): void {
    if (this.timerId) clearTimeout(this.timerId);
    this.timerId = null;
    this.mode = null;
    this.endTime = 0;
    this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
    this.gainNode.gain.setTargetAtTime(1.0, this.audioCtx.currentTime, 0.1);
  }

  remaining(): number {
    if (!this.mode || !this.endTime) return 0;
    return Math.max(0, this.endTime - Date.now());
  }

  getState() {
    return {
      active: this.mode !== null,
      mode: this.mode,
      remainingSeconds: Math.floor(this.remaining() / 1000),
    };
  }

  setOnEndCallback(callback: () => void) {
    this.onEndCallback = callback;
  }
}
