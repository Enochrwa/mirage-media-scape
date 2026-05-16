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

  init: () => {
    queueManager.load();
    // Queue state is now managed entirely by QueueManager
    // Components can subscribe to queueManager changes via addListener
    playbackEngine.setTimeUpdateCallback((time, duration) => {
      set({ currentTime: time, duration });
    });
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
    // Report current track as skipped if there is an active track
    if (get().currentFile) {
      await playbackEngine.skipTrack();
    }
    const nextFile = await queueManager.smartNext();
    if (nextFile) {
      get().playFile(nextFile);
    } else {
      set({ currentFile: null, isPlaying: false });
    }
  },

  previousTrack: () => {
    // Implement basic previous logic
    const { currentTime } = get();
    if (currentTime > 3) {
      playbackEngine.seek(0);
    } else {
      // In a real app, this would get the previous track from the queue
      // For now, we just restart the current track
      playbackEngine.seek(0);
    }
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
    // Report current track as skipped/stopped
    playbackEngine.skipTrack();
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
