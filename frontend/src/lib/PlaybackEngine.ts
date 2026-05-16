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
  audioElement: HTMLAudioElement;
  audioSource: MediaElementAudioSourceNode;
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
  private pannerInput!: GainNode;
  private compressor!: DynamicsCompressorNode;
  private hardLimiter!: DynamicsCompressorNode;
  private preAmp!: GainNode;
  private masterGain!: GainNode;

  // Stereo Widener Nodes
  private widenerSplitter!: ChannelSplitterNode;
  private widenerMidGain!: GainNode;
  private widenerSideGain!: GainNode;
  private widenerMerger!: ChannelMergerNode;

  private state: PlaybackState = 'IDLE';
  private currentTrackId: string | null = null;
  private currentEventId: string | null = null;
  private playbackStartTime: number = 0;
  public sleepTimer: SleepTimer | null = null;
  private _capabilities: PlatformCapabilities | null = null;
  private _mediaKeys: IMediaKeyService | null = null;
  private _onTimeUpdate: ((time: number, duration: number) => void) | null = null;
  private _preloadStarted: boolean = false;
  private _preloadedFile: MediaFile | null = null;
  private _globalCrossfadeDuration: number = 2000;

  private videoSourceNodes = new WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>();
  private lastVideoElement: HTMLVideoElement | null = null;

  private boundHandlePlay = this.handlePlay.bind(this);
  private boundHandlePause = this.handlePause.bind(this);
  private boundHandleEnded = this.handleEnded.bind(this);
  private boundHandleError = (e: Event) => this.handleError(e);
  private boundHandleTimeUpdate = (e: Event) => {
    const el = e.target as HTMLMediaElement;
    const currentTime = el.currentTime;
    const duration = el.duration || 0;

    // A/B Loop Enforcement
    if (
      this._abLoop.isActive &&
      this._abLoop.pointB !== null &&
      currentTime >= this._abLoop.pointB
    ) {
      el.currentTime = this._abLoop.pointA ?? 0;
    }

    this._onTimeUpdate?.(currentTime, duration);

    if (duration > 0 && duration - currentTime < 30 && !this._preloadStarted) {
      window.dispatchEvent(new CustomEvent('zovyra-preload-next'));
    }
  };

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
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.ratio.value = 1; // Bypass (default)

    this.pannerInput = this.ctx.createGain(); // For mono merge if needed
    this.panner = this.ctx.createPanner();
    this.panner.panningModel = 'HRTF';

    // Stereo Widener (M/S Processing)
    this.widenerSplitter = this.ctx.createChannelSplitter(2);
    this.widenerMidGain = this.ctx.createGain();
    this.widenerSideGain = this.ctx.createGain();
    this.widenerMerger = this.ctx.createChannelMerger(2);

    this.hardLimiter = this.ctx.createDynamicsCompressor();
    this.hardLimiter.threshold.value = -0.1;
    this.hardLimiter.knee.value = 0;
    this.hardLimiter.ratio.value = 20;
    this.hardLimiter.attack.value = 0.001;
    this.hardLimiter.release.value = 0.1;

    this.preAmp = this.ctx.createGain();
    this.preAmp.gain.value = 1.0;

    this.masterGain = this.ctx.createGain();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Common Chain Construction
    // ... -> Compressor -> Spatial (Panner) -> Stereo Widener -> Master Gain -> Analyser -> Destination
    this.compressor.connect(this.pannerInput);
    this.pannerInput.connect(this.panner);
    this.panner.connect(this.widenerSplitter);

    // M/S Routing (Stereo Widener)
    // Formula for M/S to L/R conversion:
    // L = (M + S) / 2
    // R = (M - S) / 2
    // We use M = (L + R) and S = (L - R)

    // First, convert L/R to M/S
    // M = L + R
    const msEncoder = this.ctx.createGain();
    const sEncoder = this.ctx.createGain();
    const sInverter = this.ctx.createGain();
    sInverter.gain.value = -1;

    this.widenerSplitter.connect(msEncoder, 0); // L
    this.widenerSplitter.connect(msEncoder, 1); // R
    this.widenerSplitter.connect(sEncoder, 0); // L
    this.widenerSplitter.connect(sInverter, 1); // R
    sInverter.connect(sEncoder);

    // Apply Gains to M and S
    msEncoder.connect(this.widenerMidGain);
    sEncoder.connect(this.widenerSideGain);

    // Convert back to L/R
    // L = (M + S) * 0.5
    // R = (M - S) * 0.5
    const leftSum = this.ctx.createGain();
    leftSum.gain.value = 0.5;
    const rightDiff = this.ctx.createGain();
    rightDiff.gain.value = 0.5;
    const rightSideInverter = this.ctx.createGain();
    rightSideInverter.gain.value = -1;

    this.widenerMidGain.connect(leftSum);
    this.widenerSideGain.connect(leftSum);

    this.widenerMidGain.connect(rightDiff);
    this.widenerSideGain.connect(rightSideInverter);
    rightSideInverter.connect(rightDiff);

    leftSum.connect(this.widenerMerger, 0, 0);
    rightDiff.connect(this.widenerMerger, 0, 1);

    this.widenerMerger.connect(this.hardLimiter);
    this.hardLimiter.connect(this.preAmp);
    this.preAmp.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Analyser is a tap (parallel) from the master gain
    this.masterGain.connect(this.analyser);

    // Two parallel chains for crossfading
    this.chains = [this.createChain(), this.createChain()];

    this.sleepTimer = new SleepTimer(this.masterGain, this.ctx, () => this.pause());
  }

  private createChain(): TrackChain {
    const el = new Audio();
    el.crossOrigin = 'anonymous';

    if (this.capabilities.canUseHardwareDecoding) {
      el.setAttribute('x-webkit-airplay', 'allow');
    }

    const source = this.ctx.createMediaElementSource(el);

    // Stats tracking: monitor media element events
    el.addEventListener('play', this.boundHandlePlay);
    el.addEventListener('pause', this.boundHandlePause);
    el.addEventListener('ended', this.boundHandleEnded);
    el.addEventListener('error', this.boundHandleError);
    el.addEventListener('timeupdate', this.boundHandleTimeUpdate);

    // 1. ReplayGain
    const replayGain = this.ctx.createGain();
    source.connect(replayGain);

    // 2. EQ Chain
    const frequencies = [80, 250, 1000, 4000, 12000];
    const types: BiquadFilterType[] = ['peaking', 'peaking', 'peaking', 'peaking', 'peaking'];
    const eq: BiquadFilterNode[] = [];

    let lastNode: AudioNode = replayGain;
    for (let i = 0; i < 5; i++) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = types[i];
      filter.frequency.value = frequencies[i];
      filter.gain.value = 0;
      lastNode.connect(filter);
      eq.push(filter);
      lastNode = filter;
    }

    // 3. Crossfade (joining point)
    const fade = this.ctx.createGain();
    lastNode.connect(fade);
    fade.connect(this.compressor);

    return {
      audioElement: el,
      audioSource: source,
      element: el,
      source,
      eq,
      replayGain,
      fade,
    };
  }

  async load(file: MediaFile, startNext: boolean = false) {
    this.initContext();
    if (!startNext) {
      this._preloadStarted = false;
    }
    // If this load is replacing the active track (not preloading), report previous track as skipped
    if (!startNext && this.currentEventId && this.currentTrackId) {
      await this.reportPlaybackEnd(false, true);
    }

    // If this is a video, we don't load it in the background Audio element.
    // VideoPlayer.tsx will call loadVideo() which attaches the real element.
    if (file.type === 'video' && !startNext) {
      this.currentTrackId = file.id;
      this.setState('LOADING');
      return;
    }

    const index = startNext ? (this.activeIndex + 1) % 2 : this.activeIndex;
    const chain = this.chains[index];

    // Restore audio source if it was swapped by a video and this is an audio file
    if (chain.element !== chain.audioElement && file.type !== 'video') {
      chain.element.pause();
      chain.element.removeEventListener('play', this.boundHandlePlay);
      chain.element.removeEventListener('pause', this.boundHandlePause);
      chain.element.removeEventListener('ended', this.boundHandleEnded);
      chain.element.removeEventListener('error', this.boundHandleError);
      chain.element.removeEventListener('timeupdate', this.boundHandleTimeUpdate);

      if (chain.element instanceof HTMLVideoElement) {
        chain.element.src = '';
        chain.element.load();
        if (this.lastVideoElement === chain.element) {
          this.lastVideoElement = null;
        }
      }

      try {
        chain.source.disconnect();
      } catch (e) {
        // Ignore disconnect error
      }
      chain.element = chain.audioElement;
      chain.source = chain.audioSource;
      chain.source.connect(chain.replayGain);

      // Re-attach listeners to audio element
      chain.element.addEventListener('play', this.boundHandlePlay);
      chain.element.addEventListener('pause', this.boundHandlePause);
      chain.element.addEventListener('ended', this.boundHandleEnded);
      chain.element.addEventListener('error', this.boundHandleError);
      chain.element.addEventListener('timeupdate', this.boundHandleTimeUpdate);
    }

    this.currentTrackId = file.id;
    this.setState('LOADING');
    chain.element.src = file.file;
    chain.element.load();

    // ReplayGain application
    let gainDb = 0;
    const mode = localStorage.getItem('ZOVYRA_replaygain_mode') || 'track';
    if (mode !== 'off') {
      if (mode === 'track' && file.replaygain_track_gain != null) {
        gainDb = file.replaygain_track_gain;
      } else if (mode === 'album' && file.replaygain_album_gain != null) {
        gainDb = file.replaygain_album_gain;
      } else if (file.replay_gain_db) {
        gainDb = file.replay_gain_db;
      }
    }

    const gain = Math.pow(10, gainDb / 20);
    chain.replayGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);

    // Preferred speed
    if (file.preferred_speed) {
      chain.element.playbackRate = file.preferred_speed;
    }

    // Encoder padding/delay trimming (Gapless precision)
    if (file.encoder_delay || file.encoder_padding) {
      // In a real Web Audio implementation, we'd use AudioBufferSourceNode
      // and slice the buffer. With HTMLMediaElement, we can only try to seek
      // slightly forward for delay, but padding at end is harder without MSE.
      // For now, we note the values.
      console.log(
        `[PlaybackEngine] Gapless info: delay=${file.encoder_delay}, padding=${file.encoder_padding}`,
      );
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

    // Cleanup old listeners if we are swapping elements
    if (chain.element !== videoElement) {
      chain.element.pause();
      chain.element.removeEventListener('play', this.boundHandlePlay);
      chain.element.removeEventListener('pause', this.boundHandlePause);
      chain.element.removeEventListener('ended', this.boundHandleEnded);
      chain.element.removeEventListener('error', this.boundHandleError);
      chain.element.removeEventListener('timeupdate', this.boundHandleTimeUpdate);

      // Reset src to stop background activity if it's the audio element
      if (chain.element === chain.audioElement) {
        chain.element.src = '';
        chain.element.load();
      }
    }

    if (this.lastVideoElement && this.lastVideoElement !== videoElement) {
      this.lastVideoElement.pause();
      this.lastVideoElement.removeEventListener('play', this.boundHandlePlay);
      this.lastVideoElement.removeEventListener('pause', this.boundHandlePause);
      this.lastVideoElement.removeEventListener('ended', this.boundHandleEnded);
      this.lastVideoElement.removeEventListener('error', this.boundHandleError);
      this.lastVideoElement.removeEventListener('timeupdate', this.boundHandleTimeUpdate);
      this.lastVideoElement.src = '';
      this.lastVideoElement.load();
    }

    // Disconnect current source
    try {
      chain.source.disconnect();
    } catch (e) {
      // Ignore disconnect error
    }

    // Reuse or create source node for the video element
    let videoSource = this.videoSourceNodes.get(videoElement);
    if (!videoSource) {
      videoSource = this.ctx.createMediaElementSource(videoElement);
      this.videoSourceNodes.set(videoElement, videoSource);
    }

    chain.element = videoElement;
    chain.source = videoSource;
    chain.source.connect(chain.replayGain);

    // Attach listeners to video element (only if changed or first time)
    if (this.lastVideoElement !== videoElement) {
      videoElement.addEventListener('play', this.boundHandlePlay);
      videoElement.addEventListener('pause', this.boundHandlePause);
      videoElement.addEventListener('ended', this.boundHandleEnded);
      videoElement.addEventListener('error', this.boundHandleError);
      videoElement.addEventListener('timeupdate', this.boundHandleTimeUpdate);
      this.lastVideoElement = videoElement;
    }

    // Set src and load
    videoElement.src = file.file;
    chain.element.load();

    if (file.replay_gain_db) {
      const gain = Math.pow(10, file.replay_gain_db / 20);
      chain.replayGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
    } else {
      chain.replayGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
    }

    if (this.capabilities.canControlMediaKeys) {
      this.mediaKeys.updateMetadata(file);
    }

    this.currentTrackId = file.id;

    if (this.state === 'PLAYING') {
      videoElement.play().catch((e) => console.error('Failed to resume video playback', e));
    }
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
    this.initContext();
    if (enabled) {
      this.panner.panningModel = 'HRTF';
    } else {
      this.panner.panningModel = 'equalpower';
      // Do not reset position to (0,0,0) here to preserve state for re-enable
    }
  }

  setSpatialPosition(x: number, y: number, z: number) {
    this.initContext();
    this.panner.positionX.setTargetAtTime(x, this.ctx.currentTime, 0.1);
    this.panner.positionY.setTargetAtTime(y, this.ctx.currentTime, 0.1);
    this.panner.positionZ.setTargetAtTime(z, this.ctx.currentTime, 0.1);
  }

  setSpatialMonoMerge(enabled: boolean) {
    this.initContext();
    // To merge to mono before panner, we set pannerInput gain to 0.5 for each channel
    // and connect both channels of the preceding node to it.
    // Actually, PannerNode by default downmixes to mono if its input is mono.
    // If we want to force mono input to panner:
    if (enabled) {
      this.pannerInput.channelCount = 1;
      this.pannerInput.channelCountMode = 'explicit';
    } else {
      this.pannerInput.channelCount = 2;
      this.pannerInput.channelCountMode = 'max';
    }
  }

  updateListenerOrientation(
    forward: { x: number; y: number; z: number },
    up: { x: number; y: number; z: number },
  ) {
    this.initContext();
    if (this.ctx.listener.forwardX) {
      this.ctx.listener.forwardX.setTargetAtTime(forward.x, this.ctx.currentTime, 0.1);
      this.ctx.listener.forwardY.setTargetAtTime(forward.y, this.ctx.currentTime, 0.1);
      this.ctx.listener.forwardZ.setTargetAtTime(forward.z, this.ctx.currentTime, 0.1);
      this.ctx.listener.upX.setTargetAtTime(up.x, this.ctx.currentTime, 0.1);
      this.ctx.listener.upY.setTargetAtTime(up.y, this.ctx.currentTime, 0.1);
      this.ctx.listener.upZ.setTargetAtTime(up.z, this.ctx.currentTime, 0.1);
    } else {
      // Fallback for older browsers
      this.ctx.listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  setEQBand(index: number, gain: number) {
    this.initContext();
    this.chains.forEach((chain) => {
      if (chain.eq[index]) {
        chain.eq[index].gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
      }
    });
  }

  getFrequencyResponse(frequencies: Float32Array) {
    this.initContext();
    const magResponse = new Float32Array(frequencies.length);
    const phaseResponse = new Float32Array(frequencies.length);
    const totalMag = new Float32Array(frequencies.length).fill(1.0);

    // Sum responses of all filters in the active chain
    const chain = this.chains[this.activeIndex];
    chain.eq.forEach((filter) => {
      // @ts-expect-error - compatibility between Float32Array types
      filter.getFrequencyResponse(frequencies, magResponse, phaseResponse);
      for (let i = 0; i < frequencies.length; i++) {
        totalMag[i] *= magResponse[i];
      }
    });

    return totalMag;
  }

  setBassEnhancerEnabled(enabled: boolean) {
    this.initContext();
    // Simple implementation: boost low shelf
    this.setEQBand(0, enabled ? 6 : 0);
  }

  setEQBypass(bypass: boolean) {
    this.initContext();
    this.chains.forEach((chain) => {
      chain.eq.forEach((filter, i) => {
        // If bypass is true, we don't necessarily want to zero out the bands,
        // but the canonical way is to disconnect them.
        // However, for simplicity and to match the "bypass toggle" requirement,
        // we can just set gains to 0 if bypassed, or manage a separate bypass gain.
        // Let's use a simpler approach: if bypassed, set gain to 0.
        // Better: user might want to toggle bypass without losing their settings.
        // So we'll need to store the settings.
      });
    });
  }

  setCompressorParams(params: {
    threshold?: number;
    ratio?: number;
    knee?: number;
    attack?: number;
    release?: number;
    enabled?: boolean;
  }) {
    this.initContext();
    const now = this.ctx.currentTime;
    if (params.enabled === false) {
      this.compressor.ratio.setTargetAtTime(1, now, 0.1);
      return;
    }
    if (params.threshold !== undefined)
      this.compressor.threshold.setTargetAtTime(params.threshold, now, 0.1);
    if (params.ratio !== undefined) this.compressor.ratio.setTargetAtTime(params.ratio, now, 0.1);
    if (params.knee !== undefined) this.compressor.knee.setTargetAtTime(params.knee, now, 0.1);
    if (params.attack !== undefined)
      this.compressor.attack.setTargetAtTime(params.attack, now, 0.1);
    if (params.release !== undefined)
      this.compressor.release.setTargetAtTime(params.release, now, 0.1);
  }

  getCompressorReduction() {
    return this.compressor ? this.compressor.reduction : 0;
  }

  setNightModeEnabled(enabled: boolean) {
    this.initContext();
    if (enabled) {
      this.setCompressorParams({
        threshold: -24,
        knee: 30,
        ratio: 12,
        attack: 0.003,
        release: 0.25,
        enabled: true,
      });
    } else {
      this.setCompressorParams({ enabled: false });
    }
  }

  setStereoWidth(width: number) {
    this.initContext();
    // width: 0 (mono) to 2 (hyper-wide). 1 is normal.
    // Mid gain should be 1.0, Side gain should be 'width'
    this.widenerMidGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
    this.widenerSideGain.gain.setTargetAtTime(width, this.ctx.currentTime, 0.1);
  }

  setPlaybackRate(rate: number) {
    this.initContext();
    this.chains.forEach((chain) => {
      chain.element.playbackRate = rate;
      // Note: HTMLMediaElement preserves pitch by default in most browsers
      // when playbackRate is changed.
    });
  }

  setPreAmp(gainDb: number) {
    this.initContext();
    const gain = Math.pow(10, gainDb / 20);
    this.preAmp.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
  }

  setSleepTimer(minutes: number) {
    this.sleepTimer?.set(minutes);
  }

  setGlobalCrossfadeDuration(durationMs: number) {
    this._globalCrossfadeDuration = durationMs;
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
    usePlayerStore.setState({
      isPlaying: s === 'PLAYING',
      currentEngineTrackId: this.currentTrackId,
    });
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
    this.setState('PLAYING');
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
    this.setState('PAUSED');
    // Don't report end yet - could be resume. Stats event end is sent on track switch or ended.
    // This is handled by track change logic or explicit stop.
  }

  private async handleEnded() {
    this.setState('ENDED');
    await this.reportPlaybackEnd(true, false);

    if (this._preloadedFile) {
      const file = this._preloadedFile;
      this._preloadedFile = null;
      await this.crossfadeTo(file, this._globalCrossfadeDuration);
      // After crossfade, update store with the new current file
      usePlayerStore.setState({ currentFile: file, isPlaying: true });
      return;
    }

    window.dispatchEvent(new CustomEvent('zovyra-track-ended'));
  }

  async crossfadeTo(file: MediaFile, durationMs: number = 3000) {
    this.initContext();
    const oldId = this.currentTrackId;
    const nextIndex = (this.activeIndex + 1) % 2;
    const currentChain = this.chains[this.activeIndex];
    const nextChain = this.chains[nextIndex];

    // Smart Crossfade detection
    // If it's a live album continuation, we might want to disable crossfade
    // but the spec says "Smart crossfade auto-disables for live album continuations"
    // which usually means gapless.
    // We assume if crossfadeTo is called, we want a crossfade unless it's overridden.

    // Preload next track silently
    // Note: load() updates this.currentTrackId
    await this.load(file, true); // startNext = true

    // Start next chain playing at volume 0
    nextChain.fade.gain.setValueAtTime(0, this.ctx.currentTime);
    nextChain.element.play();

    // Crossfade over durationMs
    const durationSec = durationMs / 1000;
    const now = this.ctx.currentTime;
    currentChain.fade.gain.cancelScheduledValues(now);
    nextChain.fade.gain.cancelScheduledValues(now);
    currentChain.fade.gain.setValueAtTime(currentChain.fade.gain.value, now);
    nextChain.fade.gain.setValueAtTime(nextChain.fade.gain.value, now);

    currentChain.fade.gain.linearRampToValueAtTime(0, now + durationSec);
    nextChain.fade.gain.linearRampToValueAtTime(1, now + durationSec);

    // After crossfade, clean up old chain
    setTimeout(() => {
      currentChain.element.pause();
      currentChain.element.src = '';
      this.activeIndex = nextIndex;
      this._preloadStarted = false;
    }, durationMs + 100);

    // Update currentTrackId to the new one and report the previous ended
    // We do this BEFORE the timeout to ensure we don't end the newly started event
    if (oldId) {
      const newId = this.currentTrackId;
      // Temporarily swap trackId to report the correct one
      this.currentTrackId = oldId;
      await this.reportPlaybackEnd(true, false);
      this.currentTrackId = newId;
    }
  }

  startPreload(file: MediaFile) {
    if (this._preloadStarted) return;
    this._preloadStarted = true;
    this._preloadedFile = file;
    this.load(file, true); // preload into the inactive chain
  }

  private async handleError(_e: Event) {
    this.setState('ERROR');
    await this.reportPlaybackEnd(false, true);
  }

  private async reportPlaybackEnd(completed: boolean, skipped: boolean) {
    if (!this.currentEventId || !this.currentTrackId) {
      this.currentEventId = null;
      this.currentTrackId = null;
      return;
    }
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

  /**
   * Samples a short snippet of audio at the given position.
   * Used for crossfade preview or waveform scrubbing.
   */
  async samplePreview(file: MediaFile, position: number, durationMs: number = 2000) {
    this.initContext();
    const tempAudio = new Audio(file.file);
    tempAudio.crossOrigin = 'anonymous';
    const tempSource = this.ctx.createMediaElementSource(tempAudio);
    const tempGain = this.ctx.createGain();

    tempSource.connect(tempGain);
    tempGain.connect(this.ctx.destination);

    tempAudio.currentTime = position;
    tempGain.gain.setValueAtTime(0, this.ctx.currentTime);
    tempAudio.play();
    tempGain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.1);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        tempGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
        setTimeout(() => {
          tempAudio.pause();
          tempSource.disconnect();
          tempGain.disconnect();
          resolve();
        }, 150);
      }, durationMs);
    });
  }
}

export const playbackEngine = new PlaybackEngine();
