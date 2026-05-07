
export class PlaybackEngine {
    private ctx: AudioContext;
    private currentSource: AudioBufferSourceNode | null = null;
    private nextSource: AudioBufferSourceNode | null = null;
    private nextBuffer: AudioBuffer | null = null;
    private gainNode: GainNode;
    private nextStartTime: number = 0;
    private isPlaying: boolean = false;

    constructor() {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.gainNode = this.ctx.createGain();
        this.gainNode.connect(this.ctx.destination);
    }

    async preloadNext(url: string) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            this.nextBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            console.log('Next track preloaded and decoded');
        } catch (error) {
            console.error('Failed to preload next track:', error);
        }
    }

    play(buffer: AudioBuffer, startTime: number = 0) {
        this.stop();

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gainNode);

        const now = this.ctx.currentTime;
        source.start(now, startTime);

        this.currentSource = source;
        this.nextStartTime = now + buffer.duration - startTime;
        this.isPlaying = true;

        source.onended = () => {
            if (this.currentSource === source) {
                this.isPlaying = false;
            }
        };
    }

    scheduleNext(buffer: AudioBuffer) {
        if (!this.isPlaying) {
            this.play(buffer);
            return;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gainNode);

        source.start(this.nextStartTime);

        this.nextSource = source;
        const duration = buffer.duration;

        source.onended = () => {
            this.currentSource = this.nextSource;
            this.nextSource = null;
            this.nextStartTime += duration;
        };
    }

    stop() {
        if (this.currentSource) {
            this.currentSource.stop();
            this.currentSource = null;
        }
        if (this.nextSource) {
            this.nextSource.stop();
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
        this.gainNode.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
    }

    get currentTime() {
        return this.ctx.currentTime;
    }
}

export const playbackEngine = new PlaybackEngine();
