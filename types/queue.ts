import { Track } from './track';

export type ShuffleMode = 'off' | 'on' | 'smart';
export type RepeatMode = 'off' | 'one' | 'all';

export interface QueueState {
  queue: Track[];
  currentIndex: number;
  history: Track[];
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
}
