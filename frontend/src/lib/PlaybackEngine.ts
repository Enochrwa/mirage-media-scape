import { API_BASE } from './utils';
import { SleepTimer } from '@/engines/SleepTimer';
import { MediaFile } from '@/types/media';
import { getPlatform, PlatformCapabilities } from '../platform';
import { getMediaKeyService, IMediaKeyService } from '../services/mediaKeys';
import { usePlayerStore } from '@/store/usePlayerStore';

// ZOVYRA AUDIO GRAPH — CANONICAL CHAIN (DO NOT REORDER)
// Source (MediaElementSourceNode)
//   → ReplayGain     (GainNode — gain = 10^(replayGainDb/20), default 1.0)
//   → EQ Chain       (5× BiquadFilterNode: peaking filters at 80Hz, 250Hz, 1kHz, 4kHz, 12kHz)
//   → Compressor     (DynamicsCompressorNode — bypassable, three levels: off/standard/night)
//   → Crossfade      (GainNode — managed by engine)
//   → Spatial Panner (PannerNode — HRTF, bypassable — zero cost when off)
//   → Stereo Widener (M/S Processing)
//   → Master Volume  (GainNode)
//   → Analyser       (AnalyserNode — fftSize 2048, smoothing 0.8)
//   → Destination

interface TrackChain {
  element: HTMLMediaElement;
  source: MediaElementAudioSourceNode;
  replayGain: GainNode;
  eq: BiquadFilterNode[];
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

  private bridgeSource: AudioBufferSourceNode | null = null;
  private bridgeGain: GainNode | null = null;
  private bridgeTimeout: ReturnType<typeof setTimeout> | null = null;

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
    this.compressor.ratio.value = 1;

    this.pannerInput = this.ctx.createGain();
    this.panner = this.ctx.createPanner();
    this.panner.panningModel = 'HRTF';

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
    this.masterGain = this.ctx.createGain();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    // Routing
    this.compressor.connect(this.pannerInput);
    this.pannerInput.connect(this.panner);
    this.panner.connect(this.widenerSplitter);

    const msEncoder = this.ctx.createGain();
    const sEncoder = this.ctx.createGain();
    const sInverter = this.ctx.createGain();
    sInverter.gain.value = -1;

    this.widenerSplitter.connect(msEncoder, 0);
    this.widenerSplitter.connect(msEncoder, 1);
    this.widenerSplitter.connect(sEncoder, 0);
    this.widenerSplitter.connect(sInverter, 1);
    sInverter.connect(sEncoder);

    msEncoder.connect(this.widenerMidGain);
    sEncoder.connect(this.widenerSideGain);

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
    this.masterGain.connect(this.analyser);

    this.chains = [this.createChain(), this.createChain()];
    this.sleepTimer = new SleepTimer(this.masterGain, this.ctx, () => this.pause());
  }

  private createChain(): TrackChain {
    const el = document.createElement('audio');
    el.crossOrigin = 'anonymous';

    const source = this.ctx.createMediaElementSource(el);
    const replayGain = this.ctx.createGain();
    source.connect(replayGain);

    const frequencies = [80, 250, 1000, 4000, 12000];
    const eq: BiquadFilterNode[] = [];
    let lastNode: AudioNode = replayGain;

    for (const freq of frequencies) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.gain.value = 0;
      lastNode.connect(filter);
      eq.push(filter);
      lastNode = filter;
    }

    const fade = this.ctx.createGain();
    lastNode.connect(fade);
    fade.connect(this.compressor);

    el.addEventListener('play', () => this.handlePlay());
    el.addEventListener('pause', () => this.handlePause());
    el.addEventListener('ended', () => this.handleEnded());
    el.addEventListener('error', (e) => this.handleError(e));
    el.addEventListener('timeupdate', () => {
      const currentTime = el.currentTime;
      const duration = el.duration || 0;
      if (
        this._abLoop.isActive &&
        this._abLoop.pointB !== null &&
        currentTime >= this._abLoop.pointB
      ) {
        el.currentTime = this._abLoop.pointA ?? 0;
      }
      this._onTimeUpdate?.(currentTime, duration);
      if (duration > 0 && duration - currentTime < 10 && !this._preloadStarted) {
        void this.prepareGaplessBridge();
      }
    });

    return { element: el, source, replayGain, eq, fade };
  }

  /**
   * True when `track` is an internet-radio / live-stream entry rather than a
   * library file. These have no row in the tracks DB, so `track.id` cannot
   * be used to build `/api/stream/:id` — that always 404s, which is why
   * radio stations used to "play" (UI state flips, no error surfaces) with
   * total silence. Detection order: explicit flag set by the radio page,
   * then the legacy `album === 'Radio'` convention used elsewhere in the
   * player (MiniPlayer, WaveformSeekBar) for back-compat.
   */
  private isLiveStream(track: MediaFile): boolean {
    return Boolean(track.isStream) || track.album === 'Radio';
  }

  private async resolveTrackUrl(track: MediaFile): Promise<string> {
    const platform = this.capabilities;

    if (this.isLiveStream(track)) {
      return this.resolveStreamUrl(track);
    }

    if (platform.host === 'mobile') {
      const { MobileMediaService } = await import('../services/mobileMedia/MobileMediaService');
      return MobileMediaService.getPlayableUri(track);
    }
    if (platform.host === 'desktop') {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('get_file_url', { path: track.file_path });
    }

    const baseUrl = `${API_BASE}/api/stream/${track.id}`;

    // Check if browser can play natively
    const ext = track.file_path?.split('.').pop()?.toLowerCase() ?? '';
    const nativeExts = ['mp3', 'flac', 'm4a', 'ogg', 'wav', 'opus', 'aac', 'mp4', 'webm'];

    if (!nativeExts.includes(ext)) {
      // Force transcoding for unsupported formats
      return `${baseUrl}?transcode=1`;
    }

    // For video, check hardware decode capability (placeholder for real check)
    if (track.type === 'video') {
      const codec = track.codec?.toLowerCase() ?? '';
      const browserUnsupported = ['hevc', 'h265', 'vc1', 'wmv3', 'theora'].some((c) =>
        codec.includes(c),
      );
      if (browserUnsupported) {
        return `${baseUrl}?transcode=1`;
      }
    }

    return baseUrl;
  }

  /**
   * Radio stations carry their playable URL directly on `track.file` (set by
   * RadioPage from the radio-browser API's `url_resolved`). On web we proxy
   * it through the server's `/api/radio/stream` endpoint — most Icecast/
   * Shoutcast stations don't send `Access-Control-Allow-Origin`, and this
   * engine's <audio> elements are wired into a MediaElementAudioSourceNode
   * (crossOrigin="anonymous") for EQ/visualizer/spatial processing. Without
   * CORS, the browser plays the tagged-as-opaque response completely
   * muted — `play()` resolves, the `playing` event fires, the UI shows
   * "LIVE", but the Web Audio graph never receives audible samples. The
   * server-side proxy avoids that entirely (same-origin response), and
   * already validates the target URL against private/internal hosts.
   * On native platforms (mobile/desktop) there's no Web Audio CORS
   * restriction in the same way, so we play the stream URL directly.
   */
  private resolveStreamUrl(track: MediaFile): string {
    const directUrl = track.file || track.file_path || '';
    if (!directUrl) return directUrl;

    if (this.capabilities.host === 'mobile' || this.capabilities.host === 'desktop') {
      return directUrl;
    }

    // Already pointed at our own proxy (e.g. re-resolved after a restore) —
    // don't double-wrap it.
    if (directUrl.startsWith(`${API_BASE}/api/radio/stream`)) {
      return directUrl;
    }

    return `${API_BASE}/api/radio/stream?url=${encodeURIComponent(directUrl)}`;
  }

  async load(file: MediaFile, startNext: boolean = false) {
    this.initContext();
    if (!startNext) {
      if (this.bridgeTimeout) {
        clearTimeout(this.bridgeTimeout);
        this.bridgeTimeout = null;
      }
      if (this.bridgeSource) {
        try {
          this.bridgeSource.stop();
        } catch (e) {
          console.error('Failed to stop bridge source', e);
        }
        this.bridgeSource = null;
      }
    }
    if (!startNext && this.currentEventId && this.currentTrackId) {
      await this.reportPlaybackEnd(false, true);
    }
    const index = startNext ? (this.activeIndex + 1) % 2 : this.activeIndex;
    const chain = this.chains[index];
    this.currentTrackId = file.id;
    this.setState('LOADING');
    const url = await this.resolveTrackUrl(file);
    chain.element.src = url;
    chain.element.load();
    let gainDb = 0;
    const mode = localStorage.getItem('ZOVYRA_replaygain_mode') || 'track';
    if (mode === 'track') gainDb = file.replaygain_track_gain ?? 0;
    else if (mode === 'album') gainDb = file.replaygain_album_gain ?? 0;
    const gain = Math.pow(10, gainDb / 20);
    chain.replayGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
    if (file.preferred_speed) chain.element.playbackRate = file.preferred_speed;
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
    try {
      chain.source.disconnect();
    } catch (e) {
      console.error('Failed to disconnect source', e);
    }
    const source = this.ctx.createMediaElementSource(videoElement);
    chain.element = videoElement;
    chain.source = source;
    chain.source.connect(chain.replayGain);
    const url = await this.resolveTrackUrl(file);
    videoElement.src = url;
    videoElement.load();
    this.currentTrackId = file.id;
    if (this.capabilities.canControlMediaKeys) {
      this.mediaKeys.updateMetadata(file);
    }
  }

  private async prepareGaplessBridge() {
    if (this._preloadStarted) return;
    const freeMB = navigator.deviceMemory || 4;
    if (freeMB < 0.5) return;
    this._preloadStarted = true;
    window.dispatchEvent(new CustomEvent('zovyra-preload-next'));
  }

  async startPreload(file: MediaFile) {
    await this.preloadNextForGapless(file);
  }

  async preloadNextForGapless(file: MediaFile) {
    this._preloadedFile = file;
    try {
      const url = await this.resolveTrackUrl(file);
      const res = await fetch(url, { headers: { Range: 'bytes=0-524288' } });
      const buffer = await res.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(buffer);
      this.bridgeSource = this.ctx.createBufferSource();
      this.bridgeSource.buffer = audioBuffer;
      this.bridgeGain = this.ctx.createGain();
      this.bridgeGain.gain.value = 0;
      this.bridgeSource.connect(this.bridgeGain);
      this.bridgeGain.connect(this.compressor);
      const currentEl = this.chains[this.activeIndex].element;
      const remaining = currentEl.duration - currentEl.currentTime;
      const startTime = this.ctx.currentTime + remaining;
      this.bridgeSource.start(startTime);
      this.bridgeGain.gain.setValueAtTime(1, startTime);
      this.bridgeTimeout = setTimeout(() => {
        void this.load(file);
        this.play();
        this.bridgeTimeout = null;
      }, remaining * 1000);
    } catch (e) {
      console.error('Gapless bridge failed', e);
    }
  }

  play() {
    this.initContext();
    void this.ctx.resume();
    void this.chains[this.activeIndex].element.play();
    this.setState('PLAYING');
  }
  pause() {
    this.chains[this.activeIndex].element.pause();
    this.setState('PAUSED');
  }
  resume() {
    this.play();
  }
  togglePlayback() {
    if (this.state === 'PLAYING') {
      this.pause();
    } else {
      this.play();
    }
  }
  seek(s: number) {
    this.chains[this.activeIndex].element.currentTime = s;
  }
  setVolume(v: number) {
    this.initContext();
    this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  setEQBand(i: number, g: number) {
    this.initContext();
    this.chains.forEach((c) => {
      if (c.eq[i]) c.eq[i].gain.setTargetAtTime(g, this.ctx.currentTime, 0.1);
    });
  }

  setSpatialAudioEnabled(e: boolean) {
    this.initContext();
    this.panner.panningModel = e ? 'HRTF' : 'equalpower';
  }

  isSpatialAudioEnabled() {
    return this.panner?.panningModel === 'HRTF';
  }

  setSpatialPosition(x: number, y: number, z: number) {
    this.initContext();
    this.panner.positionX.setTargetAtTime(x, this.ctx.currentTime, 0.1);
    this.panner.positionY.setTargetAtTime(y, this.ctx.currentTime, 0.1);
    this.panner.positionZ.setTargetAtTime(z, this.ctx.currentTime, 0.1);
  }

  setSpatialMonoMerge(e: boolean) {
    this.initContext();
    this.pannerInput.channelCount = e ? 1 : 2;
  }

  updateListenerOrientation(
    f: { x: number; y: number; z: number },
    u: { x: number; y: number; z: number },
  ) {
    this.initContext();
    if (this.ctx.listener.forwardX) {
      this.ctx.listener.forwardX.setValueAtTime(f.x, this.ctx.currentTime);
      this.ctx.listener.forwardY.setValueAtTime(f.y, this.ctx.currentTime);
      this.ctx.listener.forwardZ.setValueAtTime(f.z, this.ctx.currentTime);
      this.ctx.listener.upX.setValueAtTime(u.x, this.ctx.currentTime);
      this.ctx.listener.upY.setValueAtTime(u.y, this.ctx.currentTime);
      this.ctx.listener.upZ.setValueAtTime(u.z, this.ctx.currentTime);
    }
  }

  setCompressorParams(p: {
    enabled?: boolean;
    threshold?: number;
    ratio?: number;
    attack?: number;
    release?: number;
  }) {
    this.initContext();
    const now = this.ctx.currentTime;
    if (p.enabled === false) {
      this.compressor.ratio.setTargetAtTime(1, now, 0.1);
      return;
    }
    if (p.threshold !== undefined) this.compressor.threshold.setTargetAtTime(p.threshold, now, 0.1);
    if (p.ratio !== undefined) this.compressor.ratio.setTargetAtTime(p.ratio, now, 0.1);
    if (p.attack !== undefined) this.compressor.attack.setTargetAtTime(p.attack, now, 0.1);
    if (p.release !== undefined) this.compressor.release.setTargetAtTime(p.release, now, 0.1);
  }

  getCompressorReduction() {
    return this.compressor?.reduction || 0;
  }

  setStereoWidth(w: number) {
    this.initContext();
    this.widenerMidGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
    this.widenerSideGain.gain.setTargetAtTime(w, this.ctx.currentTime, 0.1);
  }

  setTimeUpdateCallback(cb: (time: number, duration: number) => void) {
    this._onTimeUpdate = cb;
  }
  getActiveElement() {
    return this.chains[this.activeIndex].element;
  }
  get analyserNode() {
    this.initContext();
    return this.analyser;
  }
  getAnalyser() {
    return this.analyserNode;
  }
  get currentTime() {
    return this.chains[this.activeIndex].element.currentTime;
  }

  getFrequencyResponse(f: Float32Array) {
    const mag = new Float32Array(f.length);
    const phase = new Float32Array(f.length);
    (
      this.chains[this.activeIndex].eq[0] as unknown as {
        getFrequencyResponse: (f: Float32Array, mag: Float32Array, phase: Float32Array) => void;
      }
    ).getFrequencyResponse(f, mag, phase);
    return mag;
  }

  setState(s: PlaybackState) {
    this.state = s;
    usePlayerStore.setState({
      isPlaying: s === 'PLAYING',
      currentEngineTrackId: this.currentTrackId,
    });
  }

  private async handlePlay() {
    this.setState('PLAYING');
    if (!this.currentTrackId || this.currentEventId) return;
    try {
      const res = await fetch(`${API_BASE}/api/stats/event/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: this.currentTrackId, source: 'player' }),
      });
      const { data } = (await res.json()) as { data: { eventId: string } };
      this.currentEventId = data?.eventId;
      this.playbackStartTime = Date.now();
    } catch (e) {
      console.error('Failed to handle play event', e);
    }
  }

  private handlePause() {
    this.setState('PAUSED');
  }

  private async handleEnded() {
    this.setState('ENDED');
    await this.reportPlaybackEnd(true, false);
    window.dispatchEvent(new CustomEvent('zovyra-track-ended'));
  }

  private async handleError(e: unknown) {
    console.error('Playback error', e);
    this.setState('ERROR');
    await this.reportPlaybackEnd(false, true);
  }

  private async reportPlaybackEnd(completed: boolean, skipped: boolean) {
    if (!this.currentEventId || !this.currentTrackId) return;
    try {
      const secondsPlayed = (Date.now() - this.playbackStartTime) / 1000;
      await fetch(`${API_BASE}/api/stats/event/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: this.currentEventId, secondsPlayed, completed, skipped }),
      });
    } catch (e) {
      console.error('Failed to report playback end', e);
    } finally {
      this.currentEventId = null;
      this.currentTrackId = null;
    }
  }

  async skipTrack() {
    await this.reportPlaybackEnd(false, true);
  }

  get abLoop() {
    return {
      pointA: this._abLoop.pointA,
      pointB: this._abLoop.pointB,
      isActive: this._abLoop.isActive,
      setA: (t: number) => {
        this._abLoop.pointA = t;
        this._abLoop.isActive = t !== null && this._abLoop.pointB !== null;
      },
      setB: (t: number) => {
        this._abLoop.pointB = t;
        this._abLoop.isActive = t !== null && this._abLoop.pointA !== null;
      },
      toggle: () => {
        this._abLoop.isActive = !this._abLoop.isActive;
      },
    };
  }

  setReplayGain(mode: string) {
    localStorage.setItem('ZOVYRA_replaygain_mode', mode);
  }
  setCrossfadeDuration(d: number) {
    this._globalCrossfadeDuration = d;
  }
  setGlobalCrossfadeDuration(d: number) {
    this._globalCrossfadeDuration = d;
  }
  setPreAmp(g: number) {
    this.initContext();
    this.preAmp.gain.setTargetAtTime(Math.pow(10, g / 20), this.ctx.currentTime, 0.1);
  }
  setBassEnhancerEnabled(e: boolean) {
    this.setEQBand(0, e ? 6 : 0);
  }
  setNightModeEnabled(e: boolean) {
    this.setCompressorParams({ enabled: e, threshold: -24, ratio: 12 } as {
      enabled: boolean;
      threshold: number;
      ratio: number;
    });
  }
  setPlaybackRate(r: number) {
    this.chains.forEach((c) => (c.element.playbackRate = r));
  }
  preview(t: number) {
    this.seek(t);
    this.play();
    setTimeout(() => this.pause(), 3000);
  }
  async samplePreview(f: MediaFile, p: number, d: number) {
    this.preview(p);
  }
}

export const playbackEngine = new PlaybackEngine();
