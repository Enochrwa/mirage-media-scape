import { Track } from '../../types/track';
import { API_BASE } from '../lib/utils';

export class QueueManager {
  private queue: Track[] = [];
  private currentIndex: number = -1;
  private history: Track[] = [];
  private shuffleMode: 'off' | 'on' | 'smart' = 'off';
  private repeatMode: 'off' | 'one' | 'all' = 'off';

  addToQueue(track: Track, position: 'next' | 'last' = 'last') {
    if (position === 'next') {
      this.queue.splice(this.currentIndex + 1, 0, track);
    } else {
      this.queue.push(track);
    }
    this.save();
  }

  reorder(fromIndex: number, toIndex: number) {
    const [item] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, item);
    this.save();
  }

  remove(index: number) {
    this.queue.splice(index, 1);
    if (index <= this.currentIndex) this.currentIndex--;
    this.save();
  }

  removeDuplicates() {
    const seen = new Set();
    const originalLen = this.queue.length;
    this.queue = this.queue.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    this.save();
    return originalLen - this.queue.length;
  }

  async smartNext(): Promise<Track | null> {
    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      return this.queue[this.currentIndex];
    }

    if (this.repeatMode === 'all') {
      this.currentIndex = 0;
      return this.queue[0];
    }

    if (this.repeatMode === 'off') {
      const current = this.queue[this.currentIndex];
      if (current) {
        const res = await fetch(`${API_BASE}/api/tracks/recommendations/${current.id}?limit=10`);
        const { data } = await res.json();
        if (data && data.length > 0) {
          this.queue.push(...data);
          this.currentIndex++;
          this.save();
          return data[0];
        }
      }
    }

    return null;
  }

  private save() {
    localStorage.setItem('ZOVYRA_queue', JSON.stringify(this.queue));
    localStorage.setItem('ZOVYRA_currentIndex', this.currentIndex.toString());
  }
}

export const queueManager = new QueueManager();
