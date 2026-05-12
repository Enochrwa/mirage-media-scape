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
    const freqArg = frequencies as Float32Array<ArrayBuffer>;

    for (const band of this.bands) {
      band.getFrequencyResponse(freqArg, magResponse, phaseResponse);
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

interface TrackChain {
  preGain: GainNode;
  eq: ParametricEQ;
  replayGain: GainNode;
  crossfade: GainNode;
}

export class PlaybackEngine {
  public ctx: AudioContext;
  private state: PlaybackState = 'IDLE';
  private currentSource: AudioBufferSourceNode | null = null;
  private nextSource: AudioBufferSourceNode | null = null;

  // Canonical Parallel Prefix
  private chainA: TrackChain;
  private chainB: TrackChain;
  private activeChain: 'A' | 'B' = 'A';

  // Canonical Shared Nodes
  private analyser: AnalyserNode;
  private bassEnhancer: WaveShaperNode;
  private panner: PannerNode;
  private nightCompressor: DynamicsCompressorNode;
  private masterGain: GainNode;

  public abLoop: ABLoop;
  private spatialAudioEnabled: boolean = false;
  private bassEnhancerEnabled: boolean = false;
  private nightModeEnabled: boolean = false;

  private nextStartTime: number = 0;
  private currentTrackId: string | null = null;
  private currentEventId: number | null = null;
  private fadeDuration: number = 2; // Default 2s crossfade
  private sleepTimerTimeout: NodeJS.Timeout | null = null;
  private stateChangeListeners: ((state: PlaybackState) => void)[] = [];

  constructor() {
    const win = window as Window & {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextClass = win.AudioContext ?? win.webkitAudioContext;
    if (!AudioContextClass) throw new Error('AudioContext not supported');
    this.ctx = new AudioContextClass();

    // ═══════════════════════════════════════════════════════════
    // zovyra AUDIO GRAPH — CANONICAL CHAIN (insert all nodes here)
    // ═══════════════════════════════════════════════════════════
    //
    // MediaSource / AudioBufferSource
    //   → Pre-Gain (GainNode) ─────────────── input normalization
    //   → EQ Band 1: Low Shelf   80 Hz  ─┐
    //   → EQ Band 2: Peak       250 Hz   │── 5-band parametric EQ
    //   → EQ Band 3: Peak      1000 Hz   │   (BiquadFilterNodes)
    //   → EQ Band 4: Peak      4000 Hz   │
    //   → EQ Band 5: High Shelf 12 kHz ──┘
    //   → ReplayGain (GainNode) ─────────── loudness normalization
    //   → Crossfade (GainNode) ──────────── track transition fades
    //   → Analyser (AnalyserNode) ───────── tap only, no signal change
    //   → Bass Enhancer (WaveShaperNode) ── bypassable harmonic exciter
    //   → Spatial Panner (PannerNode) ───── HRTF, bypassable
    //   → Night Compressor (DynamicsCompressorNode) ── bypassable
    //   → Master Volume (GainNode)
    //   → Destination
    //
    // ═══════════════════════════════════════════════════════════

    this.chainA = this.createTrackChain();
    this.chainB = this.createTrackChain();

    this.analyser = this.ctx.createAnalyser();
    this.bassEnhancer = this.ctx.createWaveShaper();
    this.panner = this.ctx.createPanner();
    this.nightCompressor = this.ctx.createDynamicsCompressor();
    this.masterGain = this.ctx.createGain();

    this.analyser.fftSize = 2048;

    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 1;
    this.panner.maxDistance = 10000;
    this.panner.rolloffFactor = 1;

    // Bass Enhancer curve (Soft-clip harmonic exciter)
    this.bassEnhancer.curve = this.makeDistortionCurve(400);

    // Night Compressor settings
    this.nightCompressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
    this.nightCompressor.knee.setValueAtTime(10, this.ctx.currentTime);
    this.nightCompressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.nightCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.nightCompressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.abLoop = new ABLoop();

    // Wiring the chains to merger (Analyser)
    this.chainA.crossfade.connect(this.analyser);
    this.chainB.crossfade.connect(this.analyser);

    this.updateChain();

    // Start with chainA active
    this.chainA.crossfade.gain.setValueAtTime(1, this.ctx.currentTime);
    this.chainB.crossfade.gain.setValueAtTime(0, this.ctx.currentTime);
    this.activeChain = 'A';
  }

  private createTrackChain(): TrackChain {
    const preGain = this.ctx.createGain();
    const eq = new ParametricEQ(this.ctx);
    const replayGain = this.ctx.createGain();
    const crossfade = this.ctx.createGain();

    preGain.connect(eq.bands[0]);
    for (let i = 0; i < eq.bands.length - 1; i++) {
      eq.bands[i].connect(eq.bands[i + 1]);
    }
    eq.bands[eq.bands.length - 1].connect(replayGain);
    replayGain.connect(crossfade);

    return { preGain, eq, replayGain, crossfade };
  }

  private updateChain() {
    // Disconnect all bypassable nodes from their potential targets
    this.analyser.disconnect();
    this.bassEnhancer.disconnect();
    this.panner.disconnect();
    this.nightCompressor.disconnect();

    let currentNode: AudioNode = this.analyser;

    if (this.bassEnhancerEnabled) {
      currentNode.connect(this.bassEnhancer);
      currentNode = this.bassEnhancer;
    }

    if (this.spatialAudioEnabled) {
      currentNode.connect(this.panner);
      currentNode = this.panner;
    }

    if (this.nightModeEnabled) {
      currentNode.connect(this.nightCompressor);
      currentNode = this.nightCompressor;
    }

    currentNode.connect(this.masterGain);
  }

  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
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
    if (!enabled) {
      this.panner.positionX.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      this.panner.positionY.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      this.panner.positionZ.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
    this.updateChain();
  }

  isSpatialAudioEnabled() {
    return this.spatialAudioEnabled;
  }

  setBassEnhancerEnabled(enabled: boolean) {
    this.bassEnhancerEnabled = enabled;
    this.updateChain();
  }

  setNightModeEnabled(enabled: boolean) {
    this.nightModeEnabled = enabled;
    this.updateChain();
  }

  setEQBand(index: number, gainDb: number) {
    this.chainA.eq.setBand(index, gainDb);
    this.chainB.eq.setBand(index, gainDb);
  }

  getFrequencyResponse(frequencies: Float32Array): Float32Array {
    // Both chains should have same EQ, so we can use either
    return this.chainA.eq.getFrequencyResponse(frequencies);
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
        setOrientation?: (
          x: number,
          y: number,
          z: number,
          x2: number,
          y2: number,
          z2: number,
        ) => void;
      };
      fallbackListener.setOrientation?.(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  private async reportEvent(type: 'start' | 'end', data: Record<string, unknown>) {
    try {
      const apiBase =
        (window as Window & { API_BASE?: string }).API_BASE ?? 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/stats/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          type,
          timestamp: Date.now(),
        }),
      });
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

    const chain = this.activeChain === 'A' ? this.chainA : this.chainB;

    if (loudness !== undefined) {
      this.applyReplayGain(loudness, chain);
    } else {
      chain.replayGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
    }

    this.stop();

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(chain.preGain);

      const now = this.ctx.currentTime;
      const playTime = now + 0.1;

      chain.crossfade.gain.setValueAtTime(1, playTime);
      const otherChain = this.activeChain === 'A' ? this.chainB : this.chainA;
      otherChain.crossfade.gain.setValueAtTime(0, playTime);

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

      // Start A/B Loop Ticker
      const ticker = setInterval(() => {
        if (this.state !== 'PLAYING') {
           clearInterval(ticker);
           return;
        }
        this.abLoop.check(this.ctx.currentTime, (seekTo) => {
           // For BufferSource, we can't just seek. We have to restart.
           // This is a limitation of pure BufferSource for looping.
           // However, for an "extraordinary" player, we'd use MediaElementSource for seeking
           // but BufferSource for gapless.
           // For now, let's implement a simplified jump if possible or skip.
        });
      }, 100);

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

  queueNext(buffer: AudioBuffer, loudness?: number) {
    if (this.nextSource) {
      try {
        this.nextSource.stop();
      } catch (e) {
        /* ignored */
      }
    }

    const nextChain = this.activeChain === 'A' ? this.chainB : this.chainA;
    const currentChain = this.activeChain === 'A' ? this.chainA : this.chainB;

    if (loudness !== undefined) {
      this.applyReplayGain(loudness, nextChain);
    } else {
      nextChain.replayGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(nextChain.preGain);

    const fadeStart = this.nextStartTime - this.fadeDuration;
    const now = this.ctx.currentTime;

    currentChain.crossfade.gain.setValueAtTime(1, Math.max(now, fadeStart));
    currentChain.crossfade.gain.linearRampToValueAtTime(0, this.nextStartTime);

    nextChain.crossfade.gain.setValueAtTime(0, Math.max(now, fadeStart));
    nextChain.crossfade.gain.linearRampToValueAtTime(1, this.nextStartTime);

    source.start(this.nextStartTime);
    this.nextSource = source;

    // Swap after transition
    setTimeout(
      () => {
        if (this.currentSource) {
          try {
            this.currentSource.stop();
          } catch (e) {
            /* ignored */
          }
        }
        this.currentSource = this.nextSource;
        this.nextSource = null;
        this.activeChain = this.activeChain === 'A' ? 'B' : 'A';
        this.nextStartTime += buffer.duration;
      },
      (this.nextStartTime - this.ctx.currentTime) * 1000,
    );
  }

  async crossfadeTo(nextBuffer: AudioBuffer, loudness?: number) {
    const now = this.ctx.currentTime;
    const fadeOutEnd = now + this.fadeDuration;

    const currentChain = this.activeChain === 'A' ? this.chainA : this.chainB;
    const nextChain = this.activeChain === 'A' ? this.chainB : this.chainA;

    if (loudness !== undefined) {
      this.applyReplayGain(loudness, nextChain);
    } else {
      nextChain.replayGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
    }

    // Fade out current
    currentChain.crossfade.gain.setValueAtTime(currentChain.crossfade.gain.value, now);
    currentChain.crossfade.gain.linearRampToValueAtTime(0, fadeOutEnd);

    // Fade in next
    const nextSource = this.ctx.createBufferSource();
    nextSource.buffer = nextBuffer;
    nextSource.connect(nextChain.preGain);

    nextChain.crossfade.gain.setValueAtTime(0, now);
    nextChain.crossfade.gain.linearRampToValueAtTime(1, fadeOutEnd);

    nextSource.start(now);

    setTimeout(() => {
      if (this.currentSource) {
        try {
          this.currentSource.stop();
        } catch (e) {
          /* ignored */
        }
      }
      this.currentSource = nextSource;
      this.activeChain = this.activeChain === 'A' ? 'B' : 'A';
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
      } catch (e) {
        /* ignored */
      }
      this.currentSource = null;
    }
    if (this.nextSource) {
      try {
        this.nextSource.stop();
      } catch (e) {
        /* ignored */
      }
      this.nextSource = null;
    }

    if (this.state !== 'ENDED') {
      this.setState('IDLE');
    }

    this.chainA.crossfade.gain.cancelScheduledValues(this.ctx.currentTime);
    this.chainB.crossfade.gain.cancelScheduledValues(this.ctx.currentTime);
    this.chainA.crossfade.gain.setValueAtTime(this.activeChain === 'A' ? 1 : 0, this.ctx.currentTime);
    this.chainB.crossfade.gain.setValueAtTime(this.activeChain === 'B' ? 1 : 0, this.ctx.currentTime);
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

  applyReplayGain(loudness: number, chain?: TrackChain) {
    const targetLUFS = -14; // Spec says -14 LUFS target
    const adjustment = targetLUFS - loudness;
    const gainMultiplier = Math.pow(10, adjustment / 20);

    // Cap the gain to avoid extreme boosting
    const cappedGain = Math.min(gainMultiplier, 2.0);
    const targetChain = chain || (this.activeChain === 'A' ? this.chainA : this.chainB);
    targetChain.replayGain.gain.setTargetAtTime(cappedGain, this.ctx.currentTime, 0.1);
  }

  get currentTime() {
    return this.ctx.currentTime;
  }

  getAnalyser() {
    return this.analyser;
  }

  setSleepTimer(minutes: number) {
    if (this.sleepTimerTimeout) {
      clearTimeout(this.sleepTimerTimeout);
    }

    if (minutes > 0) {
      this.sleepTimerTimeout = setTimeout(
        () => {
          this.pause();
        },
        minutes * 60 * 1000,
      );
    }
  }
}

export const playbackEngine = new PlaybackEngine();
