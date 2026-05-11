import { create } from 'zustand';
import { MediaFile } from '@/types/media';
import { playbackEngine, PlaybackState, PlaybackEngine } from '@/lib/PlaybackEngine';

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
        playbackEngine.play(audioBuffer, 0, file.loudness ?? undefined, file.id);
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

  nextTrack: (files) => {
    if (files.length === 0) return;
    const { currentFile, shuffle, repeat } = get();
    const currentIndex = files.findIndex((file) => file.id === currentFile?.id);

    if (shuffle) {
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
  usePlayerStore.setState({ isPlaying: state === 'PLAYING' });
});
