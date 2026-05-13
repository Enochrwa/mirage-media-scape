import { create } from 'zustand';
import { MediaFile } from '@/types/media';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { queueManager } from '@/engines/QueueManager';
import { Track } from '../../types/track';
import { toast } from '@/hooks/use-toast';

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;

  // Actions
  playTrack: (track: Track) => Promise<void>;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  next: () => Promise<void>;
  setVolume: (v: number) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,

  playTrack: async (track: Track) => {
    set({ currentTrack: track, isPlaying: true });
    await playbackEngine.load(track);
    playbackEngine.play();
  },

  pause: () => {
    playbackEngine.pause();
    set({ isPlaying: false });
  },

  resume: () => {
    playbackEngine.play();
    set({ isPlaying: true });
  },

  toggle: () => {
    const { isPlaying } = get();
    if (isPlaying) get().pause();
    else get().resume();
  },

  seek: (time) => {
    playbackEngine.seek(time);
    set({ currentTime: time });
  },

  next: async () => {
    const nextTrack = await queueManager.smartNext();
    if (nextTrack) {
      get().playTrack(nextTrack);
    }
  },

  setVolume: (v) => {
    playbackEngine.setVolume(v);
    set({ volume: v });
  },
}));

// Listen for end of track
window.addEventListener('zovyra-track-ended', () => {
  usePlayerStore.getState().next();
});
