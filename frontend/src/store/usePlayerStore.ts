import { create } from 'zustand';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { queueManager } from '@/engines/QueueManager';
import { MediaFile } from '@/types/media';
import { API_BASE } from '@/lib/utils';

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
  currentEngineTrackId: string | null;
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
  currentEngineTrackId: null,
  playbackEngine,

  init: () => {
    const { playFile, nextTrack } = get();
    const savedVolume = parseFloat(localStorage.getItem('ZOVYRA_volume') ?? '0.8');
    playbackEngine.setVolume(savedVolume);
    set({ volume: savedVolume });

    queueManager.load();
    queueManager.setOnQueueExhausted(async () => {
      const current = get().currentFile;
      if (!current) return;
      try {
        const res = await fetch(`${API_BASE}/api/tracks/${current.id}/recommendations?limit=10`);
        const { data } = await res.json();
        if (data?.length > 0) {
          data.forEach((t: MediaFile) => queueManager.addToQueue(t, 'last'));
          const next = await queueManager.smartNext();
          if (next) playFile(next);
        }
      } catch (e) {
        console.error('Failed to fetch recommendations for queue', e);
      }
    });

    // Queue state is now managed entirely by QueueManager
    // Components can subscribe to queueManager changes via addListener
    playbackEngine.setTimeUpdateCallback((time, duration) => {
      set({ currentTime: time, duration });
    });

    window.addEventListener('zovyra-preload-next', async () => {
      // Find the next track without moving the index
      const queue = queueManager.getQueue();
      const currentIndex = queueManager.getCurrentIndex();
      if (currentIndex < queue.length - 1) {
        playbackEngine.startPreload(queue[currentIndex + 1]);
      }
    });
  },

  playFile: async (file: MediaFile) => {
    set({ currentFile: file, isPlaying: true });
    await playbackEngine.load(file);
    playbackEngine.play();
  },

  pausePlayback: () => {
    if (!get().currentFile) return;
    playbackEngine.pause();
    set({ isPlaying: false });
  },

  resumePlayback: () => {
    if (!get().currentFile) return;
    playbackEngine.play();
    set({ isPlaying: true });
  },

  togglePlayback: () => {
    if (!get().currentFile) return;
    const { isPlaying } = get();
    if (isPlaying) get().pausePlayback();
    else get().resumePlayback();
  },

  seekTo: (time: number) => {
    if (!get().currentFile) return;
    playbackEngine.seek(time);
    set({ currentTime: time });
  },

  nextTrack: async () => {
    // Report current track as skipped if there is an active track
    if (get().currentFile) {
      await playbackEngine.skipTrack();
    }

    const { shuffle } = get();

    if (shuffle) {
      const queue = queueManager.getQueue();
      const currentIndex = queueManager.getCurrentIndex();
      // Pick random index that isn't current
      const available = queue.filter((_, i) => i !== currentIndex);
      if (available.length > 0) {
        const randomFile = available[Math.floor(Math.random() * available.length)];
        const newIndex = queue.findIndex((f) => f.id === randomFile.id);
        queueManager.setCurrentIndex(newIndex);
        get().playFile(randomFile);
        return;
      }
    }

    const nextFile = await queueManager.smartNext();
    if (nextFile) {
      get().playFile(nextFile);
    } else {
      get().pausePlayback();
      set({ currentFile: null });
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
    localStorage.setItem('ZOVYRA_volume', String(v));
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
    const { repeat, currentFile } = store.getState();
    if (repeat && currentFile) {
      // Repeat current track
      playbackEngine.seek(0);
      playbackEngine.play();
      return;
    }
    store.getState().nextTrack();
  });
}

export const usePlayerStore = store;
