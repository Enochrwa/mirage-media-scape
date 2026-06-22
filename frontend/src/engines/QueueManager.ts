import { MediaFile } from '@/types/media';

export type RepeatMode = 'off' | 'all' | 'one';

const REPEAT_CYCLE: RepeatMode[] = ['off', 'all', 'one'];

export class QueueManager {
  private queue: MediaFile[] = [];
  private currentIndex: number = -1;
  /**
   * Stack of tracks actually played, most-recent last. Pushed to in
   * `smartNext`/`playFromHistory` whenever playback genuinely advances —
   * NOT simply derived from `currentIndex - 1`, since that breaks the
   * moment shuffle is on (the "previous" track the user heard is rarely
   * the queue's previous *position*). `previousTrack()` in the player
   * store pops from this to implement real back-navigation.
   */
  private history: MediaFile[] = [];
  private shuffleMode: 'off' | 'on' | 'smart' = 'off';
  private repeatMode: RepeatMode = 'off';

  // Event emitter for state changes
  private listeners: Array<() => void> = [];

  addListener(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  addToQueue(file: MediaFile, position: 'next' | 'last' = 'last') {
    if (position === 'next') {
      this.queue.splice(this.currentIndex + 1, 0, file);
    } else {
      this.queue.push(file);
    }
    this.save();
    this.notify();
  }

  setQueue(files: MediaFile[]) {
    this.queue = [...files];
    this.currentIndex = files.length > 0 ? 0 : -1;
    this.history = [];
    this.save();
    this.notify();
  }

  reorder(fromIndex: number, toIndex: number) {
    const [item] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, item);
    // The currently-playing track may have shifted position; keep
    // currentIndex pointing at the same MediaFile rather than the same
    // numeric slot.
    if (this.currentIndex === fromIndex) {
      this.currentIndex = toIndex;
    } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
      this.currentIndex -= 1;
    } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
      this.currentIndex += 1;
    }
    this.save();
    this.notify();
  }

  remove(index: number) {
    this.queue.splice(index, 1);
    if (index <= this.currentIndex) {
      this.setCurrentIndex(Math.max(0, this.currentIndex - 1));
    } else {
      this.save();
      this.notify();
    }
  }

  removeDuplicates() {
    const seen = new Set();
    const originalLen = this.queue.length;
    this.queue = this.queue.filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
    this.save();
    this.notify();
    return originalLen - this.queue.length;
  }

  load(): void {
    try {
      const savedQueue = localStorage.getItem('ZOVYRA_queue');
      const savedIndex = localStorage.getItem('ZOVYRA_currentIndex');
      const savedHistory = localStorage.getItem('ZOVYRA_history');
      const savedRepeat = localStorage.getItem('ZOVYRA_repeatMode');
      if (savedQueue) {
        this.queue = JSON.parse(savedQueue);
      }
      if (savedIndex) {
        this.currentIndex = parseInt(savedIndex, 10);
      }
      if (savedHistory) {
        this.history = JSON.parse(savedHistory);
      }
      if (savedRepeat === 'off' || savedRepeat === 'all' || savedRepeat === 'one') {
        this.repeatMode = savedRepeat;
      }
    } catch (e) {
      console.error('Failed to restore queue', e);
      this.queue = [];
      this.currentIndex = -1;
      this.history = [];
    }
  }

  getQueue(): MediaFile[] {
    return [...this.queue];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  setCurrentIndex(index: number): void {
    this.currentIndex = index;
    this.save();
    this.notify();
  }

  getRepeatMode(): RepeatMode {
    return this.repeatMode;
  }

  setRepeatMode(mode: RepeatMode): void {
    this.repeatMode = mode;
    this.save();
    this.notify();
  }

  /** Advances off→all→one→off, matching the convention used by every
   * mainstream player (VLC, Spotify, Apple Music, YouTube Music). */
  cycleRepeatMode(): RepeatMode {
    const i = REPEAT_CYCLE.indexOf(this.repeatMode);
    const next = REPEAT_CYCLE[(i + 1) % REPEAT_CYCLE.length];
    this.setRepeatMode(next);
    return next;
  }

  /** True history-based "go back". Returns the previous track actually
   * played, or null if there's no history (caller should fall back to
   * restarting the current track). Does not mutate `currentIndex` —
   * the caller decides whether/how to resume forward navigation from here. */
  popHistory(): MediaFile | null {
    const prev = this.history.pop();
    if (!prev) return null;
    // Keep currentIndex aligned with the track we're moving to when it
    // still exists at a stable position in the queue, so a subsequent
    // "next" resumes from the right place rather than replaying `prev`.
    const idx = this.queue.findIndex((f) => f.id === prev.id);
    if (idx !== -1) this.currentIndex = idx;
    this.save();
    this.notify();
    return prev;
  }

  hasHistory(): boolean {
    return this.history.length > 0;
  }

  /** Records that `file` was actually played, for `popHistory` to walk
   * back through later. Called by the player store whenever playback
   * advances to a new track (smartNext, shuffle pick, manual selection). */
  pushHistory(file: MediaFile): void {
    // Avoid recording the same track twice in a row (e.g. repeat-one).
    const last = this.history[this.history.length - 1];
    if (last?.id === file.id) return;
    this.history.push(file);
    // Cap history growth for long sessions.
    if (this.history.length > 200) this.history.shift();
    this.save();
  }

  async smartNext(): Promise<MediaFile | null> {
    if (this.currentIndex < this.queue.length - 1) {
      this.setCurrentIndex(this.currentIndex + 1);
      return this.queue[this.currentIndex];
    }

    if (this.repeatMode === 'all' && this.queue.length > 0) {
      this.setCurrentIndex(0);
      return this.queue[0];
    }

    // Emit event for the store to handle recommendation fetching
    this._onQueueExhausted?.();
    return null;
  }

  private _onQueueExhausted: (() => void) | null = null;
  setOnQueueExhausted(cb: () => void) {
    this._onQueueExhausted = cb;
  }

  private save() {
    localStorage.setItem('ZOVYRA_queue', JSON.stringify(this.queue));
    localStorage.setItem('ZOVYRA_currentIndex', this.currentIndex.toString());
    localStorage.setItem('ZOVYRA_history', JSON.stringify(this.history));
    localStorage.setItem('ZOVYRA_repeatMode', this.repeatMode);
  }
}

export const queueManager = new QueueManager();
