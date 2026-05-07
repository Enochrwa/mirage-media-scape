
export class ParametricEQ {
    private ctx: AudioContext;
    private bands: BiquadFilterNode[];

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

        return bandConfigs.map(config => {
            const filter = this.ctx.createBiquadFilter();
            filter.type = config.type;
            filter.frequency.value = config.frequency;
            filter.gain.value = config.gain;
            if (config.Q) filter.Q.value = config.Q;
            return filter;
        });
    }

    connect(input: AudioNode, output: AudioNode) {
        let lastNode = input;
        for (const band of this.bands) {
            lastNode.connect(band);
            lastNode = band;
        }
        lastNode.connect(output);
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

export class PlaybackEngine {
    public ctx: AudioContext;
    private currentSource: AudioBufferSourceNode | null = null;
    private nextSource: AudioBufferSourceNode | null = null;
    private currentGainNode: GainNode;
    private nextGainNode: GainNode;
    private normalizationGain: GainNode;
    private masterGain: GainNode;
    private eq: ParametricEQ;
    private nextStartTime: number = 0;
    private isPlaying: boolean = false;
    private fadeDuration: number = 2; // Default 2s crossfade

    constructor() {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.currentGainNode = this.ctx.createGain();
        this.nextGainNode = this.ctx.createGain();
        this.normalizationGain = this.ctx.createGain();
        this.masterGain = this.ctx.createGain();
        this.eq = new ParametricEQ(this.ctx);

        this.currentGainNode.connect(this.normalizationGain);
        this.nextGainNode.connect(this.normalizationGain);
        this.normalizationGain.connect(this.masterGain);
        this.eq.connect(this.masterGain, this.ctx.destination);
    }

    play(buffer: AudioBuffer, startTime: number = 0, loudness?: number) {
        if (loudness !== undefined) {
            this.applyReplayGain(loudness);
        } else {
            this.normalizationGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
        }

        this.stop();

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.currentGainNode);

        const now = this.ctx.currentTime;
        const playTime = now + 0.1;

        this.currentGainNode.gain.setValueAtTime(1, playTime);
        source.start(playTime, startTime);

        this.currentSource = source;
        this.nextStartTime = playTime + buffer.duration - startTime;
        this.isPlaying = true;
    }

    async crossfadeTo(nextBuffer: AudioBuffer) {
        const now = this.ctx.currentTime;
        const fadeOutEnd = now + this.fadeDuration;

        // Fade out current
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
                try { this.currentSource.stop(); } catch(e) {}
            }
            this.currentSource = nextSource;
            // Swap gain nodes
            const temp = this.currentGainNode;
            this.currentGainNode = this.nextGainNode;
            this.nextGainNode = temp;

            this.nextStartTime = now + nextBuffer.duration;
        }, this.fadeDuration * 1000);
    }

    stop() {
        if (this.currentSource) {
            try { this.currentSource.stop(); } catch(e) {}
            this.currentSource = null;
        }
        if (this.nextSource) {
            try { this.nextSource.stop(); } catch(e) {}
            this.nextSource = null;
        }
        this.isPlaying = false;
    }

    pause() {
        if (this.ctx.state === 'running') {
            this.ctx.suspend();
        }
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
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

    setEQBand(index: number, gain: number) {
        this.eq.setBand(index, gain);
    }

    preloadNext(url: string) {
        // Pre-decoding logic for gapless playback would go here
        console.log(`Preloading: ${url}`);
    }

    get currentTime() {
        return this.ctx.currentTime;
    }
}

export const playbackEngine = new PlaybackEngine();
