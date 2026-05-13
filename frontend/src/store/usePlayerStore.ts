import { create } from 'zustand';
import { MediaFile } from '@/types/media';
import { playbackEngine, PlaybackState, PlaybackEngine } from '@/lib/PlaybackEngine';
import { API_BASE } from '@/lib/utils';
import type { IncomingTrack } from './useLibraryStore';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { SyncManager } from '@/lib/SyncManager';
import React from 'react';

interface PlayerState {
  playbackEngine: PlaybackEngine;
  currentFile: MediaFile | null;
  nextFile: MediaFile | null;
  queue: MediaFile[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: boolean;
  isPlayerFullscreen: boolean;
  showMobilePlayer: boolean;
  aiDjEnabled: boolean;

  // Actions
  init: () => void;
  setAiDjEnabled: (enabled: boolean) => void;
  setCurrentFile: (file: MediaFile | null) => void;
  setNextFile: (file: MediaFile | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeat: (repeat: boolean) => void;
  setPlayerFullscreen: (fullscreen: boolean) => void;
  setShowMobilePlayer: (show: boolean) => void;
  closePlayer: () => void;

  setQueue: (queue: MediaFile[]) => void;
  addToQueue: (file: MediaFile) => void;
  playNext: (file: MediaFile) => void;
  removeFromQueue: (fileId: string) => void;
  clearQueue: () => void;
  jumpToQueueIndex: (index: number) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;

  playFile: (file: MediaFile) => Promise<void>;
  pausePlayback: () => void;
  resumePlayback: () => void;
  togglePlayback: () => void;
  seekTo: (time: number) => void;
  nextTrack: () => Promise<void>;
  previousTrack: () => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const PREBUFFER_THRESHOLD = 15;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  init: () => {
    const savedQueue = localStorage.getItem('ZOVYRA_queue');
    const savedIndex = localStorage.getItem('ZOVYRA_currentIndex');
    if (savedQueue) {
      try {
        const queue = JSON.parse(savedQueue);
        const index = parseInt(savedIndex || '0');
        set({ queue, currentIndex: index });
        if (queue[index]) set({ currentFile: queue[index] });
      } catch (e) {
        console.error('Failed to restore queue', e);
      }
    }
  },
  playbackEngine,
  error: null,
  setError: (error) => set({ error }),
  currentFile: null,
  nextFile: null,
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  shuffle: false,
  repeat: false,
  isPlayerFullscreen: false,
  showMobilePlayer: false,
  aiDjEnabled: false,

  setCurrentFile: (file) => set({ currentFile: file }),
  setNextFile: (file) => set({ nextFile: file }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => {
    set({ volume });
    playbackEngine.setVolume(volume);
  },
  setCurrentTime: (currentTime) => {
    set({ currentTime });
    const { duration, nextFile } = get();
    if (duration > 0 && duration - currentTime < PREBUFFER_THRESHOLD && !nextFile) {
      const { queue: q, currentIndex: idx } = get();
      if (idx !== -1 && idx < q.length - 1) {
        const next = q[idx + 1];
        set({ nextFile: next });
        playbackEngine.preBufferNextTrack(next.id, next.file);
      }
    }
  },
  setDuration: (duration) => set({ duration }),
  setShuffle: (shuffle) => set({ shuffle }),
  setRepeat: (repeat) => set({ repeat }),
  setPlayerFullscreen: (isPlayerFullscreen) => set({ isPlayerFullscreen }),
  setShowMobilePlayer: (showMobilePlayer) => set({ showMobilePlayer }),
  setAiDjEnabled: (enabled: boolean) => set({ aiDjEnabled: enabled }),
  closePlayer: () => {
    get().pausePlayback();
    set({ currentFile: null });
  },

  setQueue: (queue) => {
    set({ queue });
    localStorage.setItem('ZOVYRA_queue', JSON.stringify(queue));
  },
  addToQueue: (file) => {
    const { queue } = get();
    const newQueue = [...queue, file];
    set({ queue: newQueue });
    localStorage.setItem('ZOVYRA_queue', JSON.stringify(newQueue));
    toast({
      title: "Added to queue",
      description: `${file.title} added to end`,
    });
  },
  playNext: (file) => {
    const { queue, currentIndex } = get();
    const newQueue = [...queue];
    newQueue.splice(currentIndex + 1, 0, file);
    set({ queue: newQueue });
    localStorage.setItem('ZOVYRA_queue', JSON.stringify(newQueue));
    toast({
      title: "Playing next",
      description: `${file.title} will play next`,
    });
  },
  removeFromQueue: (fileId) => {
    const { queue, currentIndex } = get();
    const newQueue = queue.filter(f => f.id !== fileId);
    let newIndex = currentIndex;
    const removedIndex = queue.findIndex(f => f.id === fileId);
    if (removedIndex <= currentIndex && currentIndex > 0) newIndex--;
    set({ queue: newQueue, currentIndex: newIndex });
    localStorage.setItem('ZOVYRA_queue', JSON.stringify(newQueue));
    localStorage.setItem('ZOVYRA_currentIndex', newIndex.toString());
  },
  clearQueue: () => {
    set({ queue: [], currentIndex: -1 });
    localStorage.removeItem('ZOVYRA_queue');
    localStorage.removeItem('ZOVYRA_currentIndex');
  },
  jumpToQueueIndex: (index) => {
    const { queue } = get();
    if (index >= 0 && index < queue.length) {
      set({ currentIndex: index });
      get().playFile(queue[index]);
    }
  },
  reorderQueue: (startIndex, endIndex) => {
    const { queue, currentIndex } = get();
    const newQueue = Array.from(queue);
    const [removed] = newQueue.splice(startIndex, 1);
    newQueue.splice(endIndex, 0, removed);

    let newIndex = currentIndex;
    if (currentIndex === startIndex) newIndex = endIndex;
    else if (startIndex < currentIndex && endIndex >= currentIndex) newIndex--;
    else if (startIndex > currentIndex && endIndex <= currentIndex) newIndex++;

    set({ queue: newQueue, currentIndex: newIndex });
    localStorage.setItem('ZOVYRA_queue', JSON.stringify(newQueue));
    localStorage.setItem('ZOVYRA_currentIndex', newIndex.toString());
  },

  playFile: async (file) => {
    const prevFile = get().currentFile;
    const { queue } = get();
    let index = queue.findIndex(f => f.id === file.id);
    if (index === -1) {
       index = 0;
       const newQueue = [file];
       set({ queue: newQueue, currentIndex: 0 });
       localStorage.setItem('ZOVYRA_queue', JSON.stringify(newQueue));
    } else {
       set({ currentIndex: index });
    }
    set({ currentFile: file, isPlaying: true, currentTime: 0, nextFile: null });
    localStorage.setItem('ZOVYRA_currentIndex', index.toString());

    if (file.type === 'audio') {
      playbackEngine.setState('LOADING');
      try {
        const response = await fetch(file.file);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await playbackEngine.ctx.decodeAudioData(arrayBuffer);
        if (get().aiDjEnabled && prevFile) {
           try {
              const res = await fetch(`${API_BASE}/api/ai-dj/intro?prevId=${prevFile.id}&nextId=${file.id}`);
              if (res.ok) {
                 const { intro } = await res.json();
                 const utterance = new SpeechSynthesisUtterance(intro);
                 utterance.rate = 0.9;
                 utterance.pitch = 1.0;
                 window.speechSynthesis.speak(utterance);

                 const originalVolume = get().volume;
                 playbackEngine.setVolume(originalVolume * 0.3);
                 utterance.onend = () => {
                    playbackEngine.setVolume(originalVolume);
                 };
              }
           } catch (e) { console.error('AI DJ failed', e); }
        }

        playbackEngine.play(audioBuffer, 0, file.loudness, file.id);

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

        // Auto-advance on error
        const { title } = file;
        toast({
          title: 'Playback Error',
          description: `Couldn't play ${title}. Skipping to next track.`,
          variant: 'destructive',
        });

        // Mark missing in DB (optimistic)
        fetch(`${API_BASE}/api/tracks/${file.id}/missing`, { method: 'POST' });

        setTimeout(() => {
          get().nextTrack();
        }, 1000);
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
    playbackEngine.seek(time);
  },

  nextTrack: async () => {
    const { currentFile, shuffle, repeat, nextFile, queue, currentIndex } = get();

    if (nextFile) {
       get().playFile(nextFile);
       return;
    }

    if (queue.length > 0 && currentIndex < queue.length - 1) {
       get().playFile(queue[currentIndex + 1]);
       return;
    }

    const libraryFiles = (window as unknown as { libraryFiles: MediaFile[] }).libraryFiles || [];
    if (libraryFiles.length === 0) return;

    if (shuffle) {
      try {
        const res = await fetch(`${API_BASE}/api/tracks/${currentFile?.id}/recommendations?limit=5`);
        if (res.ok) {
           const recs = await res.json() as { id: string }[];
           const nextFromRecs = recs.find(r => libraryFiles.some((f: MediaFile) => f.id === r.id));
           if (nextFromRecs) {
              const file = libraryFiles.find((f: MediaFile) => f.id === nextFromRecs.id);
              if (file) {
                 get().playFile(file);
                 return;
              }
           }
        }
      } catch (e) {
        console.error('Shuffle recommendation failed', e);
      }

      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * libraryFiles.length);
      } while (nextIndex === currentIndex && libraryFiles.length > 1);
      get().playFile(libraryFiles[nextIndex]);
    } else {
      const libIndex = libraryFiles.findIndex((f: MediaFile) => f.id === currentFile?.id);
      if (libIndex !== -1 && libIndex < libraryFiles.length - 1) {
        get().playFile(libraryFiles[libIndex + 1]);
      } else if (repeat) {
        get().playFile(libraryFiles[0]);
      } else if (currentFile) {
        try {
           const res = await fetch(`${API_BASE}/api/tracks/${currentFile.id}/recommendations?limit=10`);
           if (res.ok) {
              const recs = await res.json() as IncomingTrack[];
              if (recs.length > 0) {
                 const { mapIncomingTrackToMediaFile } = await import('./useLibraryStore');
                 get().playFile(mapIncomingTrackToMediaFile(recs[0]));
              }
           }
        } catch (e) {
           console.error('Queue extension failed', e);
        }
      }
    }
  },

  previousTrack: () => {
    const { queue, currentIndex, repeat } = get();
    if (queue.length > 0 && currentIndex > 0) {
      get().playFile(queue[currentIndex - 1]);
      return;
    }

    const libraryFiles = (window as unknown as { libraryFiles: MediaFile[] }).libraryFiles || [];
    if (libraryFiles.length === 0) return;

    const libIndex = libraryFiles.findIndex((f: MediaFile) => f.id === get().currentFile?.id);
    if (libIndex > 0) {
      get().playFile(libraryFiles[libIndex - 1]);
    } else if (repeat) {
      get().playFile(libraryFiles[libraryFiles.length - 1]);
    }
  },
}));

playbackEngine.subscribe((state: PlaybackState) => {
  const isPlaying = state === 'PLAYING';
  usePlayerStore.setState({ isPlaying });

  if (isPlaying) {
     const { currentFile, currentTime } = usePlayerStore.getState();
     if (currentFile) {
        SyncManager.emit('POSITION_CHECKPOINT', {
           trackId: currentFile.id,
           position: currentTime,
           timestamp: Date.now()
        });
     }
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }
});

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => {
    usePlayerStore.getState().resumePlayback();
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    usePlayerStore.getState().pausePlayback();
  });
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    usePlayerStore.getState().previousTrack();
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    usePlayerStore.getState().nextTrack();
  });
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime !== undefined) {
      usePlayerStore.getState().seekTo(details.seekTime);
    }
  });
}

window.addEventListener('zovyra-seek', (e: Event) => {
  const customEvent = e as CustomEvent;
  const time = customEvent.detail;
  if (typeof time === 'number') {
    usePlayerStore.getState().seekTo(time);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    window.dispatchEvent(new CustomEvent('zovyra-visibility-change', { detail: 'hidden' }));
  } else {
    window.dispatchEvent(new CustomEvent('zovyra-visibility-change', { detail: 'visible' }));
  }
});
