import { API_BASE } from './utils';
import { SleepTimer } from '@/engines/SleepTimer';
import { MediaFile } from '@/types/media';
import { getPlatform, PlatformCapabilities } from '../platform';
import { getMediaKeyService, IMediaKeyService } from '../services/mediaKeys';
import { usePlayerStore } from '@/store/usePlayerStore';

// ZOVYRA AUDIO GRAPH — CANONICAL CHAIN (DO NOT REORDER)
// Source
//   → EQ Chain       (5× BiquadFilterNode: LowShelf 80Hz, Peak 250Hz, Peak 1kHz, Peak 4kHz, HighShelf 12kHz)
//   → ReplayGain     (GainNode — gain = 10^(replayGainDb/20), default 1.0)
//   → Crossfade      (GainNode — managed by CrossfadeEngine)
//   → Analyser       (AnalyserNode — fftSize 2048, smoothing 0.8, tap only — audio passes through)
//   → Spatial Panner (PannerNode — HRTF, bypassable — zero cost when off)
//   → Compressor     (DynamicsCompressorNode — bypassable, three levels: off/standard/night)
//   → Master Volume  (GainNode)
//   → Destination

interface TrackChain {
  element: HTMLMediaElement;
  source: MediaElementAudioSourceNode;
  eq: BiquadFilterNode[];
  replayGain: GainNode;
  fade: GainNode;
}

export type PlaybackState = 'IDLE' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'ENDED' | 'ERROR';

export class PlaybackEngine {
  public ctx!: AudioContext;
  private chains: [TrackChain, TrackChain] = [] as unknown as [TrackChain, TrackChain];
  private activeIndex: number = 0;

  private analyser!: AnalyserNode;
  private panner!: PannerNode;
  private compressor!: DynamicsCompressorNode;
  private masterGain!: GainNode;

  private state: PlaybackState = 'IDLE';
  private currentTrackId: string | null = null;
  private currentEventId: string | null = null;
  private playbackStartTime: number = 0;
  public sleepTimer: SleepTimer | null = null;
  private _capabilities: PlatformCapabilities | null = null;
  private _mediaKeys: IMediaKeyService | null = null;
  private _onTimeUpdate: ((time: number, duration: number) => void) | null = null;

  private _abLoop: {
    pointA: number | null;
    pointB: number | null;
    isActive: boolean;
  } = { pointA: null, pointB: null, isActive: false };

  constructor() {
    if (typeof window === 'undefined') return;
  }

  private get capabilities() {
    if (!this._capabilities) this._capabilities = getPlatform();
    return this._capabilities;
  }

  private get mediaKeys() {
    if (!this._mediaKeys) this._mediaKeys = getMediaKeyService();
    return this._mediaKeys;
  }

  private initContext() {
    if (this.ctx) return;
    if (!this.capabilities.supportsWebAudioAPI) {
      console.warn('Web Audio API not supported on this platform');
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Shared tail of the graph
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.panner = this.ctx.createPanner();
    this.panner.panningModel = 'HRTF';

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.ratio.value = 1; // Bypass

    this.masterGain = this.ctx.createGain();

    this.analyser.connect(this.panner);
    this.panner.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Two parallel chains for crossfading
    this.chains = [this.createChain(), this.createChain()];

    this.sleepTimer = new SleepTimer(this.masterGain, this.ctx, () => this.pause());

    this.mediaKeys.setActionHandlers({
      play: () => this.togglePlayback(),
      pause: () => this.togglePlayback(),
      next: () => {
        usePlayerStore.getState().nextTrack();
      },
      previous: () => {
        usePlayerStore.getState().previousTrack();
      },
      seek: (time) => this.seek(time),
    });
  }

  private createChain(): TrackChain {
    const el = new Audio();
    el.crossOrigin = 'anonymous';

    if (this.capabilities.canUseHardwareDecoding) {
      el.setAttribute('x-webkit-airplay', 'allow');
    }

    const source = this.ctx.createMediaElementSource(el);

    // Stats tracking: monitor media element events
    el.addEventListener('play', () => this.handlePlay());
    el.addEventListener('pause', () => this.handlePause());
    el.addEventListener('ended', () => this.handleEnded());
    el.addEventListener('error', (e) => this.handleError(e));
    el.addEventListener('timeupdate', () => {
      this._onTimeUpdate?.(el.currentTime, el.duration || 0);
    });

    // 1. EQ Chain
    const frequencies = [80, 250, 1000, 4000, 12000];
    const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
    const eq: BiquadFilterNode[] = [];

    let lastNode: AudioNode = source;
    for (let i = 0; i < 5; i++) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = types[i];
      filter.frequency.value = frequencies[i];
      filter.gain.value = 0;
      lastNode.connect(filter);
      eq.push(filter);
      lastNode = filter;
    }

    // 2. ReplayGain
    const replayGain = this.ctx.createGain();
    lastNode.connect(replayGain);

    // 3. Crossfade (joining point)
    const fade = this.ctx.createGain();
    replayGain.connect(fade);
    fade.connect(this.analyser);

    return { element: el, source, eq, replayGain, fade };
  }

  async load(file: MediaFile, startNext: boolean = false) {
    this.initContext();
    // If this load is replacing the active track (not preloading), report previous track as skipped
    if (!startNext && this.currentEventId && this.currentTrackId) {
      await this.reportPlaybackEnd(false, true);
    }

    const index = startNext ? (this.activeIndex + 1) % 2 : this.activeIndex;
    const chain = this.chains[index];

    this.currentTrackId = file.id;
    chain.element.src = file.file;
    chain.element.load();

    if (file.replay_gain_db) {
      const gain = Math.pow(10, file.replay_gain_db / 20);
      chain.replayGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
    } else {
      chain.replayGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    }

    if (!startNext) {
      this.activeIndex = index;
      chain.fade.gain.setValueAtTime(1, this.ctx.currentTime);
      this.chains[(index + 1) % 2].fade.gain.setValueAtTime(0, this.ctx.currentTime);
    }

    if (this.capabilities.canControlMediaKeys) {
      this.mediaKeys.updateMetadata(file);
    }
  }

  async loadVideo(file: MediaFile, videoElement: HTMLVideoElement) {
    this.initContext();
    const chain = this.chains[this.activeIndex];

    // Disconnect old source if it exists
    try {
      chain.source.disconnect();
    } catch {}

    // Create new source from the video element
    chain.element = videoElement;
    chain.source = this.ctx.createMediaElementSource(videoElement);
    chain.source.connect(chain.eq[0]);

    // Attach listeners to video element
    videoElement.addEventListener('play', () => this.handlePlay());
    videoElement.addEventListener('pause', () => this.handlePause());
    videoElement.addEventListener('ended', () => this.handleEnded());
    videoElement.addEventListener('error', (e) => this.handleError(e));
    videoElement.addEventListener('timeupdate', () => {
      this._onTimeUpdate?.(videoElement.currentTime, videoElement.duration || 0);
    });

    // Set src and load
    videoElement.src = file.file;
    chain.element.load();

    if (file.replay_gain_db) {
      const gain = Math.pow(10, file.replay_gain_db / 20);
      chain.replayGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
    }

    if (this.capabilities.canControlMediaKeys) {
      this.mediaKeys.updateMetadata(file);
    }

    this.currentTrackId = file.id;
  }

  setTimeUpdateCallback(cb: (time: number, duration: number) => void) {
    this._onTimeUpdate = cb;
  }

  getActiveElement() {
    return this.chains[this.activeIndex].element;
  }

  play() {
    this.initContext();
    this.ctx.resume();
    this.chains[this.activeIndex].element.play();
    this.setState('PLAYING');
  }

  pause() {
    this.chains[this.activeIndex].element.pause();
    this.setState('PAUSED');
  }

  togglePlayback() {
    if (this.state === 'PLAYING') {
      this.pause();
    } else {
      this.play();
    }
  }

  resume() {
    this.chains[this.activeIndex].element.play();
    this.setState('PLAYING');
  }

  seek(seconds: number) {
    this.chains[this.activeIndex].element.currentTime = seconds;
  }

  setVolume(v: number) {
    this.initContext();
    this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  isSpatialAudioEnabled() {
    return true; // Placeholder
  }

  setSpatialAudioEnabled(enabled: boolean) {
    // Implement
  }

  setSpatialPosition(x: number, y: number, z: number) {
    // Implement
  }

  updateListenerOrientation(
    forward: { x: number; y: number; z: number },
    up: { x: number; y: number; z: number },
  ) {
    // Implement
  }

  setEQBand(index: number, gain: number) {
    // Implement
  }

  getFrequencyResponse(frequencies: Float32Array) {
    return new Float32Array(frequencies.length); // Placeholder
  }

  setBassEnhancerEnabled(enabled: boolean) {
    // Implement
  }

  setNightModeEnabled(enabled: boolean) {
    // Implement
  }

  setSleepTimer(minutes: number) {
    this.sleepTimer?.set(minutes);
  }

  preview(time: number) {
    this.initContext();
    this.chains[this.activeIndex].element.currentTime = time;
    this.chains[this.activeIndex].element.play();
    setTimeout(() => {
      this.chains[this.activeIndex].element.pause();
    }, 30000);
  }

  get currentTime() {
    return this.chains[this.activeIndex].element.currentTime;
  }

  private _setABLoopA(time: number) {
    this._abLoop.pointA = time;
    this._abLoop.isActive = this._abLoop.pointA !== null && this._abLoop.pointB !== null;
  }

  private _setABLoopB(time: number) {
    this._abLoop.pointB = time;
    this._abLoop.isActive = this._abLoop.pointA !== null && this._abLoop.pointB !== null;
  }

  private _toggleABLoop() {
    this._abLoop.isActive = !this._abLoop.isActive;
  }

  get abLoop() {
    return {
      pointA: this._abLoop.pointA,
      pointB: this._abLoop.pointB,
      isActive: this._abLoop.isActive,
      setA: this._setABLoopA.bind(this),
      setB: this._setABLoopB.bind(this),
      toggle: this._toggleABLoop.bind(this),
    };
  }

  setState(s: PlaybackState) {
    this.state = s;
    // Emit event or update store
  }

  get analyserNode() {
    this.initContext();
    return this.analyser;
  }

  getAnalyser() {
    this.initContext();
    return this.analyser;
  }

  // Stats reporting handlers
  private async handlePlay() {
    if (!this.currentTrackId) return;
    // Only report start event if we don't have an active event
    if (!this.currentEventId) {
      try {
        const res = await fetch(`${API_BASE}/api/stats/event/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackId: this.currentTrackId, source: 'player' }),
        });
        const { data } = await res.json();
        this.currentEventId = data?.eventId;
        this.playbackStartTime = Date.now();
      } catch (e) {
        console.error('Failed to report play start', e);
      }
    } else {
      // Resume after pause - update playbackStartTime to account for pause duration?
      // For simplicity, we treat resumes as continuing the same session
    }
  }

  private async handlePause() {
    // Don't report end yet - could be resume. Stats event end is sent on track switch or ended.
    // This is handled by track change logic or explicit stop.
  }

  private async handleEnded() {
    await this.reportPlaybackEnd(true, false);
  }

  private async handleError(_e: Event) {
    await this.reportPlaybackEnd(false, true);
  }

  private async reportPlaybackEnd(completed: boolean, skipped: boolean) {
    if (!this.currentEventId || !this.currentTrackId) return;
    try {
      const secondsPlayed = (Date.now() - this.playbackStartTime) / 1000;
      await fetch(`${API_BASE}/api/stats/event/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: this.currentEventId,
          secondsPlayed,
          completed,
          skipped,
        }),
      });
    } catch (e) {
      console.error('Failed to report play end', e);
    } finally {
      this.currentEventId = null;
      this.currentTrackId = null;
    }
  }

  // Call this when skipping to next track before natural end
  async skipTrack() {
    await this.reportPlaybackEnd(false, true);
  }

  // Call this when track ends naturally (also triggered by 'ended' event)
  async completeTrack() {
    await this.reportPlaybackEnd(true, false);
  }
}

export const playbackEngine = new PlaybackEngine();
