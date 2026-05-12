import { create } from 'zustand';
import { MediaFile } from '@/types/media';
import { playbackEngine, PlaybackState, PlaybackEngine } from '@/lib/PlaybackEngine';
import { API_BASE } from '@/lib/utils';
import type { IncomingTrack } from './useLibraryStore';

interface PlayerState {
  playbackEngine: PlaybackEngine;
  currentFile: MediaFile | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: boolean;
  isPlayerFullscreen: boolean;
  showMobilePlayer: boolean;

  // Actions
  setCurrentFile: (file: MediaFile | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeat: (repeat: boolean) => void;
  setPlayerFullscreen: (fullscreen: boolean) => void;
  setShowMobilePlayer: (show: boolean) => void;
  closePlayer: () => void;

  playFile: (file: MediaFile) => Promise<void>;
  pausePlayback: () => void;
  resumePlayback: () => void;
  togglePlayback: () => void;
  seekTo: (time: number) => void;
  nextTrack: (files: MediaFile[]) => void;
  previousTrack: (files: MediaFile[]) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  playbackEngine,
  error: null,
  setError: (error) => set({ error }),
  currentFile: null,
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  shuffle: false,
  repeat: false,
  isPlayerFullscreen: false,
  showMobilePlayer: false,

  setCurrentFile: (file) => set({ currentFile: file }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => {
    set({ volume });
    playbackEngine.setVolume(volume);
  },
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setShuffle: (shuffle) => set({ shuffle }),
  setRepeat: (repeat) => set({ repeat }),
  setPlayerFullscreen: (isPlayerFullscreen) => set({ isPlayerFullscreen }),
  setShowMobilePlayer: (showMobilePlayer) => set({ showMobilePlayer }),
  closePlayer: () => {
    get().pausePlayback();
    set({ currentFile: null });
  },

  playFile: async (file) => {
    set({ currentFile: file, isPlaying: true, currentTime: 0 });

    if (file.type === 'audio') {
      playbackEngine.setState('LOADING');
      try {
        const response = await fetch(file.file);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await playbackEngine.ctx.decodeAudioData(arrayBuffer);
        playbackEngine.play(audioBuffer, 0, file.loudness, file.id);

        // Media Session API
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: file.title,
            artist: file.artist,
            album: file.album,
            artwork: file.cover ? [{ src: file.cover, sizes: '512x512', type: 'image/jpeg' }] : [],
          });
        }
      } catch (error) {
        console.error('Playback Engine Error:', error);
        playbackEngine.setState('ERROR');
        set({ isPlaying: false });
      }
    } else {
      playbackEngine.setState('PLAYING');
    }
  },

  pausePlayback: () => {
    set({ isPlaying: false });
    playbackEngine.pause();
  },

  resumePlayback: () => {
    if (get().currentFile) {
      set({ isPlaying: true });
      playbackEngine.resume();
    }
  },

  togglePlayback: () => {
    const { currentFile, isPlaying } = get();
    if (currentFile) {
      const nextState = !isPlaying;
      set({ isPlaying: nextState });
      if (nextState) {
        playbackEngine.resume();
      } else {
        playbackEngine.pause();
      }
    }
  },

  seekTo: (time) => {
    set({ currentTime: time });
  },

  nextTrack: async (files) => {
    if (files.length === 0) return;
    const { currentFile, shuffle, repeat } = get();
    const currentIndex = files.findIndex((file) => file.id === currentFile?.id);

    if (shuffle) {
      // Smart Shuffle attempt
      try {
        const res = await fetch(`${API_BASE}/api/recommendations/${currentFile?.id}?limit=5`);
        if (res.ok) {
           const recs = await res.json() as { id: string }[];
           const nextFromRecs = recs.find(r => files.some(f => f.id === r.id));
           if (nextFromRecs) {
              const file = files.find(f => f.id === nextFromRecs.id);
              if (file) {
                 get().playFile(file);
                 return;
              }
           }
        }
      } catch (e) { /* fallback to random */ }

      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * files.length);
      } while (nextIndex === currentIndex && files.length > 1);
      get().playFile(files[nextIndex]);
    } else {
      if (currentIndex < files.length - 1) {
        get().playFile(files[currentIndex + 1]);
      } else if (repeat) {
        get().playFile(files[0]);
      } else if (currentFile) {
        // Auto-extend queue when empty
        try {
           const res = await fetch(`${API_BASE}/api/recommendations/${currentFile.id}?limit=10`);
           if (res.ok) {
              const recs = await res.json() as IncomingTrack[];
              if (recs.length > 0) {
                 // In a real app we'd append to queue, here we just play the first recommendation
                 const { mapIncomingTrackToMediaFile } = await import('./useLibraryStore');
                 get().playFile(mapIncomingTrackToMediaFile(recs[0]));
              }
           }
        } catch (e) { /* end */ }
      }
    }
  },

  previousTrack: (files) => {
    if (files.length === 0) return;
    const { currentFile, repeat } = get();
    const currentIndex = files.findIndex((file) => file.id === currentFile?.id);

    if (currentIndex > 0) {
      get().playFile(files[currentIndex - 1]);
    } else if (repeat) {
      get().playFile(files[files.length - 1]);
    }
  },
}));

playbackEngine.subscribe((state: PlaybackState) => {
  const isPlaying = state === 'PLAYING';
  usePlayerStore.setState({ isPlaying });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }
});

// Register Media Session actions
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => {
    usePlayerStore.getState().resumePlayback();
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    usePlayerStore.getState().pausePlayback();
  });
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    const store = usePlayerStore.getState();
    const libraryFiles = (window as unknown as { libraryFiles?: MediaFile[] }).libraryFiles || [];
    store.previousTrack(libraryFiles);
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    const store = usePlayerStore.getState();
    const libraryFiles = (window as unknown as { libraryFiles?: MediaFile[] }).libraryFiles || [];
    store.nextTrack(libraryFiles);
  });
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime !== undefined) {
      usePlayerStore.getState().seekTo(details.seekTime);
    }
  });
}

// Background Visibility Management
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Stop non-essential RAF loops / animations
    // The visualizers should subscribe to this or check it
    window.dispatchEvent(new CustomEvent('zovyra-visibility-change', { detail: 'hidden' }));
  } else {
    window.dispatchEvent(new CustomEvent('zovyra-visibility-change', { detail: 'visible' }));
  }
});
