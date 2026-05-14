import { create } from 'zustand';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { queueManager } from '@/engines/QueueManager';
import { MediaFile } from '@/types/media';

// Explicit ABLoop type matching what PlaybackEngine.abLoop returns
export interface ABLoop {
  pointA: number | null;
  pointB: number | null;
  isActive: boolean;
  setA: (time: number) => void;
  setB: (time: number) => void;
  toggle: () => void;
}

export interface PlayerState {
  currentFile: MediaFile | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: boolean;
  isPlayerFullscreen: boolean;
  showMobilePlayer: boolean;
  aiDjEnabled: boolean;
  playbackEngine: typeof playbackEngine;
  abLoop: ABLoop;

  // Actions
  init: () => void;
  playFile: (file: MediaFile) => Promise<void>;
  pausePlayback: () => void;
  resumePlayback: () => void;
  togglePlayback: () => void;
  seekTo: (time: number) => void;
  nextTrack: () => Promise<void>;
  previousTrack: () => void;
  setVolume: (v: number) => void;
  setAiDjEnabled: (enabled: boolean) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeat: (repeat: boolean) => void;
  setPlayerFullscreen: (fullscreen: boolean) => void;
  setShowMobilePlayer: (show: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  closePlayer: () => void;
}

const store = create<PlayerState>((set, get) => ({
  currentFile: null,
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  shuffle: false,
  repeat: false,
  isPlayerFullscreen: false,
  showMobilePlayer: false,
  aiDjEnabled: false,
  playbackEngine,
  abLoop: playbackEngine.abLoop,

  init: () => {
    const savedQueue = localStorage.getItem('ZOVYRA_queue');
    const savedIndex = localStorage.getItem('ZOVYRA_currentIndex');
    if (savedQueue) {
      try {
        // queueManager.load(JSON.parse(savedQueue), parseInt(savedIndex || '0'));
      } catch (e) {
        console.error('Failed to restore queue', e);
      }
    }
  },

  playFile: async (file: MediaFile) => {
    set({ currentFile: file, isPlaying: true });
    await playbackEngine.load(file);
    playbackEngine.play();
  },

  pausePlayback: () => {
    playbackEngine.pause();
    set({ isPlaying: false });
  },

  resumePlayback: () => {
    playbackEngine.play();
    set({ isPlaying: true });
  },

  togglePlayback: () => {
    const { isPlaying } = get();
    if (isPlaying) get().pausePlayback();
    else get().resumePlayback();
  },

  seekTo: (time: number) => {
    playbackEngine.seek(time);
    set({ currentTime: time });
  },

  nextTrack: async () => {
    const nextFile = await queueManager.smartNext();
    if (nextFile) {
      get().playFile(nextFile);
    }
  },

  previousTrack: () => {
    // Implement previous logic
  },

  setVolume: (v: number) => {
    playbackEngine.setVolume(v);
    set({ volume: v });
  },

  setAiDjEnabled: (enabled: boolean) => set({ aiDjEnabled: enabled }),
  setShuffle: (shuffle: boolean) => set({ shuffle }),
  setRepeat: (repeat: boolean) => set({ repeat }),
  setPlayerFullscreen: (isPlayerFullscreen: boolean) => set({ isPlayerFullscreen }),
  setShowMobilePlayer: (showMobilePlayer: boolean) => set({ showMobilePlayer }),
  setCurrentTime: (currentTime: number) => set({ currentTime }),
  setDuration: (duration: number) => set({ duration }),
  closePlayer: () => {
    get().pausePlayback();
    set({ currentFile: null });
  },
}));

// Listen for end of track
if (typeof window !== 'undefined') {
  window.addEventListener('zovyra-track-ended', () => {
    store.getState().nextTrack();
  });
}

export const usePlayerStore = store;
