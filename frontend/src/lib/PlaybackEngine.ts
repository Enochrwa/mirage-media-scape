import { API_BASE } from './utils';
import { SleepTimer } from '@/engines/SleepTimer';
import { Track } from '../../../types/track';

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
  public sleepTimer: SleepTimer | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    this.initContext();
  }

  private initContext() {
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
  }

  private createChain(): TrackChain {
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    const source = this.ctx.createMediaElementSource(el);

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

  async load(track: Track, startNext: boolean = false) {
    const index = startNext ? (this.activeIndex + 1) % 2 : this.activeIndex;
    const chain = this.chains[index];

    this.currentTrackId = track.id;
    chain.element.src = `${API_BASE}/api/tracks/stream?path=${encodeURIComponent(track.filePath)}`;
    chain.element.load();

    if (track.replayGainDb) {
      const gain = Math.pow(10, track.replayGainDb / 20);
      chain.replayGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
    } else {
      chain.replayGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    }

    if (!startNext) {
      this.activeIndex = index;
      chain.fade.gain.setValueAtTime(1, this.ctx.currentTime);
      this.chains[(index + 1) % 2].fade.gain.setValueAtTime(0, this.ctx.currentTime);
    }

    this.setupMediaSession(track);
  }

  private setupMediaSession(track: Track) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: track.coverCachePath
          ? [
              {
                src: `${API_BASE}/api/tracks/cover/${track.id}`,
                sizes: '512x512',
                type: 'image/jpeg',
              },
            ]
          : [],
      });
    }
  }

  play() {
    this.ctx.resume();
    this.chains[this.activeIndex].element.play();
    this.setState('PLAYING');
  }

  pause() {
    this.chains[this.activeIndex].element.pause();
    this.setState('PAUSED');
  }

  seek(seconds: number) {
    this.chains[this.activeIndex].element.currentTime = seconds;
  }

  setVolume(v: number) {
    this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  setState(s: PlaybackState) {
    this.state = s;
    // Emit event or update store
  }

  get analyserNode() {
    return this.analyser;
  }
}

export const playbackEngine = new PlaybackEngine();
