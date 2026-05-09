export class ParametricEQ {
  private ctx: AudioContext;
  public bands: BiquadFilterNode[];

  constructor(audioCtx: AudioContext) {
    this.ctx = audioCtx;
    this.bands = this.createBands();
  }

  private createBands() {
    const bandConfigs = [
      { type: 'lowshelf' as const, frequency: 80, gain: 0 },
      { type: 'peaking' as const, frequency: 250, gain: 0, Q: 1.0 },
      { type: 'peaking' as const, frequency: 1000, gain: 0, Q: 1.0 },
      { type: 'peaking' as const, frequency: 4000, gain: 0, Q: 1.0 },
      { type: 'highshelf' as const, frequency: 12000, gain: 0 },
    ];

    return bandConfigs.map((config) => {
      const filter = this.ctx.createBiquadFilter();
      filter.type = config.type;
      filter.frequency.value = config.frequency;
      filter.gain.value = config.gain;
      if (config.Q) filter.Q.value = config.Q;
      return filter;
    });
  }

  setBand(index: number, gain: number) {
    if (this.bands[index]) {
      this.bands[index].gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01);
    }
  }

  getFrequencyResponse(frequencies: Float32Array): Float32Array {
    const totalMag = new Float32Array(frequencies.length).fill(1);
    const magResponse = new Float32Array(frequencies.length);
    const phaseResponse = new Float32Array(frequencies.length);

    for (const band of this.bands) {
      band.getFrequencyResponse(frequencies, magResponse, phaseResponse);
      for (let i = 0; i < frequencies.length; i++) {
        totalMag[i] *= magResponse[i];
      }
    }

    return totalMag;
  }
}

export class ABLoop {
  public pointA: number | null = null;
  public pointB: number | null = null;
  public isActive: boolean = false;

  setA(time: number) {
    this.pointA = time;
  }

  setB(time: number) {
    this.pointB = time;
  }

  toggle() {
    if (this.pointA !== null && this.pointB !== null) {
      this.isActive = !this.isActive;
    }
  }

  reset() {
    this.pointA = null;
    this.pointB = null;
    this.isActive = false;
  }

  check(currentTime: number, onLoop: (seekTo: number) => void) {
    if (this.isActive && this.pointA !== null && this.pointB !== null) {
      if (currentTime >= this.pointB) {
        onLoop(this.pointA);
      }
    }
  }
}

export type PlaybackState = 'IDLE' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'ENDED' | 'ERROR';

export class PlaybackEngine {
  public ctx: AudioContext;
  private state: PlaybackState = 'IDLE';
  private currentSource: AudioBufferSourceNode | null = null;
  private nextSource: AudioBufferSourceNode | null = null;
  private currentGainNode: GainNode;
  private nextGainNode: GainNode;
  private normalizationGain: GainNode;
  private masterGain: GainNode;
  private panner: PannerNode;
  private analyser: AnalyserNode;
  private eq: ParametricEQ;
  public abLoop: ABLoop;
  private spatialAudioEnabled: boolean = false;
  private nextStartTime: number = 0;
  private currentTrackId: string | null = null;
  private currentEventId: number | null = null;
  private fadeDuration: number = 2; // Default 2s crossfade
  private sleepTimerTimeout: NodeJS.Timeout | null = null;
  private stateChangeListeners: ((state: PlaybackState) => void)[] = [];

  private compressor: DynamicsCompressorNode;

  constructor() {
    const win = window as Window & { webkitAudioContext?: typeof AudioContext };
    this.ctx = new (win.AudioContext || win.webkitAudioContext)();
    this.currentGainNode = this.ctx.createGain();
    this.nextGainNode = this.ctx.createGain();
    this.normalizationGain = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();

    this.panner = this.ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 1;
    this.panner.maxDistance = 10000;
    this.panner.rolloffFactor = 1;
    this.panner.positionX.value = 0;
    this.panner.positionY.value = 0;
    this.panner.positionZ.value = 0;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(40, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.eq = new ParametricEQ(this.ctx);
    this.abLoop = new ABLoop();

    // Chain construction based on canonical order:
    // Source → EQ Chain (5 BiquadFilterNodes) → ReplayGain (normalizationGain)
    // → Master Volume (masterGain) → Crossfade (current/nextGainNode handled in play)
    // → Analyser (tap-only) → Spatial Panner → Night Compressor → Destination

    this.currentGainNode.connect(this.normalizationGain);
    this.nextGainNode.connect(this.normalizationGain);
    this.normalizationGain.connect(this.eq.bands[0]);

    for (let i = 0; i < this.eq.bands.length - 1; i++) {
      this.eq.bands[i].connect(this.eq.bands[i + 1]);
    }

    this.eq.bands[this.eq.bands.length - 1].connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.panner);
    this.panner.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);
  }

  setState(newState: PlaybackState) {
    if (this.state !== newState) {
      this.state = newState;
      this.stateChangeListeners.forEach((l) => l(newState));
    }
  }

  getState() {
    return this.state;
  }

  subscribe(listener: (state: PlaybackState) => void) {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter((l) => l !== listener);
    };
  }

  setSpatialAudioEnabled(enabled: boolean) {
    this.spatialAudioEnabled = enabled;
    this.panner.panningModel = enabled ? 'HRTF' : 'equalpower';
    if (!enabled) {
      this.panner.positionX.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      this.panner.positionY.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      this.panner.positionZ.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }

  isSpatialAudioEnabled() {
    return this.spatialAudioEnabled;
  }

  getFrequencyResponse(frequencies: Float32Array): Float32Array {
    return this.eq.getFrequencyResponse(frequencies);
  }

  setSpatialPosition(x: number, y: number, z: number) {
    if (!this.spatialAudioEnabled) return;
    const now = this.ctx.currentTime;
    this.panner.positionX.setTargetAtTime(x, now, 0.1);
    this.panner.positionY.setTargetAtTime(y, now, 0.1);
    this.panner.positionZ.setTargetAtTime(z, now, 0.1);
  }

  updateListenerOrientation(
    forward: { x: number; y: number; z: number },
    up: { x: number; y: number; z: number },
  ) {
    const listener = this.ctx.listener;
    const now = this.ctx.currentTime;
    if (listener.forwardX) {
      listener.forwardX.setTargetAtTime(forward.x, now, 0.1);
      listener.forwardY.setTargetAtTime(forward.y, now, 0.1);
      listener.forwardZ.setTargetAtTime(forward.z, now, 0.1);
      listener.upX.setTargetAtTime(up.x, now, 0.1);
      listener.upY.setTargetAtTime(up.y, now, 0.1);
      listener.upZ.setTargetAtTime(up.z, now, 0.1);
    } else {
      // Fallback for older browsers
      const fallbackListener = listener as AudioListener & {
        setOrientation?: (x: number, y: number, z: number, x2: number, y2: number, z2: number) => void;
      };
      fallbackListener.setOrientation?.(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  private async reportEvent(type: 'start' | 'end', data: Record<string, unknown>) {
    try {
      const apiBase = (window as Window & { API_BASE?: string }).API_BASE ?? 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/stats/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            type,
            timestamp: Date.now(),
          }),
        },
      );
      if (response.ok) {
        const result = await response.json();
        if (type === 'start') this.currentEventId = result.id;
      }
    } catch (error) {
      console.error('Failed to report stats event:', error);
    }
  }

  play(buffer: AudioBuffer, startTime: number = 0, loudness?: number, trackId?: string) {
    if ((this.state === 'PLAYING' || this.state === 'PAUSED') && this.currentTrackId) {
      this.reportEvent('end', {
        track_id: this.currentTrackId,
        event_id: this.currentEventId,
        position: this.currentTime,
        completed: false,
      });
    }

    if (loudness !== undefined) {
      this.applyReplayGain(loudness);
    } else {
      this.normalizationGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
    }

    this.stop();

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.currentGainNode);

      const now = this.ctx.currentTime;
      const playTime = now + 0.1;

      this.currentGainNode.gain.setValueAtTime(1, playTime);
      source.start(playTime, startTime);

      source.onended = () => {
        if (this.currentSource === source) {
          this.setState('ENDED');
          this.stop(true);
        }
      };

      this.currentSource = source;
      this.nextStartTime = playTime + buffer.duration - startTime;
      this.setState('PLAYING');
      this.currentTrackId = trackId || null;

      if (trackId) {
        this.reportEvent('start', {
          track_id: trackId,
          position: startTime,
        });
      }
    } catch (e) {
      console.error('Failed to start playback:', e);
      this.setState('ERROR');
    }
  }

  async scheduleNext(buffer: AudioBuffer, startTime: number) {
    if (this.nextSource) {
      this.nextSource.stop();
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.nextGainNode);

    this.nextGainNode.gain.setValueAtTime(0, this.nextStartTime - this.fadeDuration);
    this.nextGainNode.gain.linearRampToValueAtTime(1, this.nextStartTime);

    this.currentGainNode.gain.setValueAtTime(1, this.nextStartTime - this.fadeDuration);
    this.currentGainNode.gain.linearRampToValueAtTime(0, this.nextStartTime);

    source.start(this.nextStartTime);
    this.nextSource = source;

    // Swap after the transition
    setTimeout(
      () => {
        if (this.currentSource) {
          try {
            this.currentSource.stop();
          } catch (e) {}
        }
        this.currentSource = this.nextSource;
        this.nextSource = null;

        // Swap gain nodes
        const temp = this.currentGainNode;
        this.currentGainNode = this.nextGainNode;
        this.nextGainNode = temp;

        this.nextStartTime += buffer.duration;
      },
      (this.nextStartTime - this.ctx.currentTime) * 1000,
    );
  }

  async crossfadeTo(nextBuffer: AudioBuffer) {
    const now = this.ctx.currentTime;
    const fadeOutEnd = now + this.fadeDuration;

    // Fade out current
    this.currentGainNode.gain.setValueAtTime(this.currentGainNode.gain.value, now);
    this.currentGainNode.gain.linearRampToValueAtTime(0, fadeOutEnd);

    // Fade in next
    const nextSource = this.ctx.createBufferSource();
    nextSource.buffer = nextBuffer;
    nextSource.connect(this.nextGainNode);

    this.nextGainNode.gain.setValueAtTime(0, now);
    this.nextGainNode.gain.linearRampToValueAtTime(1, fadeOutEnd);

    nextSource.start(now);

    // Cleanup after fade
    setTimeout(() => {
      if (this.currentSource) {
        try {
          this.currentSource.stop();
        } catch (e) {}
      }
      this.currentSource = nextSource;

      // Swap gain nodes
      const temp = this.currentGainNode;
      this.currentGainNode = this.nextGainNode;
      this.nextGainNode = temp;

      this.nextStartTime = now + nextBuffer.duration;
    }, this.fadeDuration * 1000);
  }

  stop(completed: boolean = false) {
    if (this.state === 'PLAYING' && this.currentTrackId) {
      this.reportEvent('end', {
        track_id: this.currentTrackId,
        event_id: this.currentEventId,
        position: this.currentTime,
        completed,
      });
    }

    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {}
      this.currentSource = null;
    }
    if (this.nextSource) {
      try {
        this.nextSource.stop();
      } catch (e) {}
      this.nextSource = null;
    }

    if (this.state !== 'ENDED') {
      this.setState('IDLE');
    }

    this.currentGainNode.gain.cancelScheduledValues(this.ctx.currentTime);
    this.nextGainNode.gain.cancelScheduledValues(this.ctx.currentTime);
    this.currentGainNode.gain.setValueAtTime(1, this.ctx.currentTime);
    this.nextGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
  }

  pause() {
    if (this.ctx.state === 'running') {
      this.ctx.suspend().then(() => {
        this.setState('PAUSED');
      });
    }
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.setState('PLAYING');
      });
    }
  }

  setVolume(volume: number) {
    this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
  }

  applyReplayGain(loudness: number) {
    const targetLUFS = -16;
    const adjustment = targetLUFS - loudness;
    const gainMultiplier = Math.pow(10, adjustment / 20);

    // Cap the gain to avoid extreme boosting
    const cappedGain = Math.min(gainMultiplier, 4.0);
    this.normalizationGain.gain.setTargetAtTime(cappedGain, this.ctx.currentTime, 0.1);
  }

  getEQFrequencyResponse(frequencies: Float32Array) {
    return this.eq.getFrequencyResponse(frequencies);
  }

  setEQBand(index: number, gain: number) {
    this.eq.setBand(index, gain);
  }

  startSleepTimer(durationSeconds: number) {
    if (this.sleepTimerTimeout) {
      clearTimeout(this.sleepTimerTimeout);
    }

    const fadeOutDuration = 30; // 30 seconds fade out
    const sleepTime = Math.max(0, durationSeconds - fadeOutDuration);

    this.sleepTimerTimeout = setTimeout(() => {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + fadeOutDuration);

      setTimeout(() => {
        this.stop();
        this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime);
      }, fadeOutDuration * 1000);
    }, sleepTime * 1000);
  }

  getAnalyser() {
    return this.analyser;
  }

  get currentTime() {
    return this.ctx.currentTime;
  }
}

// AUDIO GRAPH CHAIN (canonical order — insert all new nodes here):
// Source → EQ Chain (5 BiquadFilterNodes) → ReplayGain (GainNode)
// → Crossfade (GainNode) → Analyser (AnalyserNode, tap-only)
// → Spatial Panner (PannerNode, bypassable) → Night Compressor (DynamicsCompressorNode, bypassable)
// → Destination

export const playbackEngine = new PlaybackEngine();
window.playbackEngine = playbackEngine;

declare global {
  interface Window {
    playbackEngine: PlaybackEngine;
    API_BASE?: string;
    webkitAudioContext?: typeof AudioContext;
  }
}
