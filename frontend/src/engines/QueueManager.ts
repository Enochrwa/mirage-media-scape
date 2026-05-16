import { MediaFile } from '@/types/media';
import { API_BASE } from '../lib/utils';

export class QueueManager {
  private queue: MediaFile[] = [];
  private currentIndex: number = -1;
  private history: MediaFile[] = [];
  private shuffleMode: 'off' | 'on' | 'smart' = 'off';
  private repeatMode: 'off' | 'one' | 'all' = 'off';

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

  reorder(fromIndex: number, toIndex: number) {
    const [item] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, item);
    this.save();
    this.notify();
  }

  remove(index: number) {
    this.queue.splice(index, 1);
    if (index <= this.currentIndex) {
      this.setCurrentIndex(Math.max(0, this.currentIndex - 1));
    } else {
      this.save();
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
      if (savedQueue) {
        this.queue = JSON.parse(savedQueue);
      }
      if (savedIndex) {
        this.currentIndex = parseInt(savedIndex, 10);
      }
    } catch (e) {
      console.error('Failed to restore queue', e);
      this.queue = [];
      this.currentIndex = -1;
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

  async smartNext(): Promise<MediaFile | null> {
    if (this.currentIndex < this.queue.length - 1) {
      this.setCurrentIndex(this.currentIndex + 1);
      return this.queue[this.currentIndex];
    }

    if (this.repeatMode === 'all') {
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
  }
}

export const queueManager = new QueueManager();
