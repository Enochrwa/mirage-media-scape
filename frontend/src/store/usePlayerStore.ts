import { create } from 'zustand';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { queueManager, type RepeatMode } from '@/engines/QueueManager';
import { mapIncomingTrackToMediaFile } from '@/store/useLibraryStore';
import { MediaFile } from '@/types/media';
import { API_BASE } from '@/lib/utils';
import axios from 'axios';

// Explicit ABLoop type matching what PlaybackEngine.abLoop returns
export interface ABLoop {
  pointA: number | null;
  pointB: number | null;
  isActive: boolean;
  setA: (time: number) => void;
  setB: (time: number) => void;
  toggle: () => void;
}

export type { RepeatMode };

export interface PlayerState {
  currentFile: MediaFile | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  isPlayerFullscreen: boolean;
  showMobilePlayer: boolean;
  aiDjEnabled: boolean;
  autoPiP: boolean;
  currentEngineTrackId: string | null;
  playbackEngine: typeof playbackEngine;

  // Actions
  init: () => Promise<void>;
  playFile: (file: MediaFile, opts?: { recordHistory?: boolean }) => Promise<void>;
  pausePlayback: () => void;
  resumePlayback: () => void;
  togglePlayback: () => void;
  seekTo: (time: number) => void;
  nextTrack: () => Promise<void>;
  previousTrack: () => void;
  setVolume: (v: number) => void;
  setAiDjEnabled: (enabled: boolean) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  cycleRepeat: () => RepeatMode;
  setPlayerFullscreen: (fullscreen: boolean) => void;
  setShowMobilePlayer: (show: boolean) => void;
  setAutoPiP: (enabled: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  closePlayer: () => void;
  restoreSession: () => Promise<void>;
}

const store = create<PlayerState>((set, get) => ({
  currentFile: null,
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  shuffle: false,
  repeatMode: 'off',
  isPlayerFullscreen: false,
  showMobilePlayer: false,
  aiDjEnabled: false,
  autoPiP: localStorage.getItem('ZOVYRA_auto_pip') === 'true',
  currentEngineTrackId: null,
  playbackEngine,

  init: async () => {
    const { playFile } = get();

    // Load all settings from server if authenticated
    let settings: Record<string, string> = {};
    try {
      const res = await axios.get(`${API_BASE}/api/settings/user`);
      settings = res.data.settings;
    } catch (e) {
      console.error(e);
    }

    const getS = (key: string, def: string) =>
      settings[key] || localStorage.getItem(`ZOVYRA_${key}`) || def;

    const savedVolume = parseFloat(getS('volume', '0.8'));
    playbackEngine.setVolume(savedVolume);
    set({ volume: savedVolume, autoPiP: getS('auto_pip', 'false') === 'true' });

    queueManager.load();
    set({ repeatMode: queueManager.getRepeatMode() });
    get().restoreSession();

    // Restore EQ settings
    const savedEQ = getS('eq_bands', '');
    if (savedEQ) {
      try {
        const bands = JSON.parse(savedEQ);
        bands.forEach((g: number, i: number) => playbackEngine.setEQBand(i, g));
      } catch (e) {
        console.error(e);
      }
    }

    // Restore Compressor settings
    const savedCompressor = getS('compressor_settings', '');
    if (savedCompressor) {
      try {
        const { params, enabled } = JSON.parse(savedCompressor);
        playbackEngine.setCompressorParams({ ...params, enabled });
      } catch (e) {
        console.error(e);
      }
    }

    // Restore Spatial/Widening settings
    const savedSpatial = getS('spatial_settings', '');
    if (savedSpatial) {
      try {
        const s = JSON.parse(savedSpatial);
        playbackEngine.setSpatialAudioEnabled(s.enabled);
        playbackEngine.setSpatialMonoMerge(s.monoMerge || false);
        playbackEngine.setStereoWidth(s.stereoWidth ?? 1.0);
        playbackEngine.setSpatialPosition(s.pos.x, s.pos.y, s.pos.z);
      } catch (e) {
        console.error(e);
      }
    }

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

      // Persist state every 5 seconds
      const lastSave = parseInt(localStorage.getItem('ZOVYRA_last_save') || '0');
      if (Date.now() - lastSave > 5000) {
        const { currentFile, currentTime } = get();
        if (currentFile && currentTime > 5) {
          fetch(`${API_BASE}/api/stats/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trackId: currentFile.id,
              position: currentTime,
              queueSnapshot: queueManager.getQueue().map((f) => f.id),
              queueIndex: queueManager.getCurrentIndex(),
            }),
          }).catch(console.error);
          localStorage.setItem('ZOVYRA_last_save', Date.now().toString());
        }
      }
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

  playFile: async (file: MediaFile, opts) => {
    const recordHistory = opts?.recordHistory ?? true;
    const previous = get().currentFile;
    // Record what we're navigating away FROM, so previousTrack() can walk
    // back to it later. Skipped for radio streams (no meaningful "queue
    // position" to return to) and for the initial play with nothing
    // loaded yet, and suppressed when this call IS the result of
    // previousTrack() itself (recordHistory: false) so going back doesn't
    // immediately push the track we just left forward from.
    if (recordHistory && previous && previous.id !== file.id && !previous.isStream) {
      queueManager.pushHistory(previous);
    }

    set({ currentFile: file, isPlaying: true });

    // For video files, the VideoPlayer component owns the <video> element
    // and manages its own src/playback. Loading a video URL into the
    // PlaybackEngine's <audio> element causes NotSupportedError.
    if (file.type === 'video') {
      return;
    }

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
    // Mainstream-player convention (Spotify, Apple Music, YouTube Music):
    // if we're more than a few seconds into the track, "previous" restarts
    // it; only a press near the very start actually navigates back.
    const { currentTime } = get();
    if (currentTime > 3) {
      playbackEngine.seek(0);
      set({ currentTime: 0 });
      return;
    }

    const prevFile = queueManager.popHistory();
    if (prevFile) {
      get().playFile(prevFile, { recordHistory: false });
    } else {
      // No history to go back to — restart the current track instead of
      // doing nothing, matching prior behavior for the very first track.
      playbackEngine.seek(0);
      set({ currentTime: 0 });
    }
  },

  setVolume: (v: number) => {
    playbackEngine.setVolume(v);
    axios.put(`${API_BASE}/api/settings/user`, { key: 'volume', value: String(v) }).catch(() => {
      localStorage.setItem('ZOVYRA_volume', String(v));
    });
    set({ volume: v });
  },

  setAiDjEnabled: (enabled: boolean) => set({ aiDjEnabled: enabled }),
  setShuffle: (shuffle: boolean) => set({ shuffle }),
  setRepeatMode: (repeatMode: RepeatMode) => {
    queueManager.setRepeatMode(repeatMode);
    set({ repeatMode });
  },
  cycleRepeat: () => {
    const next = queueManager.cycleRepeatMode();
    set({ repeatMode: next });
    return next;
  },
  setPlayerFullscreen: (isPlayerFullscreen: boolean) => set({ isPlayerFullscreen }),
  setShowMobilePlayer: (showMobilePlayer: boolean) => set({ showMobilePlayer }),
  setAutoPiP: (autoPiP: boolean) => {
    axios
      .put(`${API_BASE}/api/settings/user`, { key: 'auto_pip', value: autoPiP.toString() })
      .catch(() => {
        localStorage.setItem('ZOVYRA_auto_pip', autoPiP.toString());
      });
    set({ autoPiP });
  },
  setCurrentTime: (currentTime: number) => set({ currentTime }),
  setDuration: (duration: number) => set({ duration }),
  closePlayer: () => {
    get().pausePlayback();
    // Report current track as skipped/stopped
    playbackEngine.skipTrack();
    set({ currentFile: null });
  },

  restoreSession: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats/state`);
      const { data } = await res.json();
      if (data && data.track_id && data.position_seconds > 5) {
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - data.timestamp < sevenDaysMs) {
          // Find track in library or fetch it
          const trackRes = await fetch(`${API_BASE}/api/tracks/${data.track_id}`);
          if (trackRes.ok) {
            const trackData = await trackRes.json();
            if (trackData && trackData.id && trackData.file_path) {
              const track = mapIncomingTrackToMediaFile(trackData);
              set({ currentFile: track });
              await playbackEngine.load(track);
              playbackEngine.seek(data.position_seconds);
              // Don't auto-play, just load
              set({ currentTime: data.position_seconds, isPlaying: false });
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to restore session', e);
    }
  },
}));

// Listen for end of track
if (typeof window !== 'undefined') {
  window.addEventListener('zovyra-track-ended', () => {
    const { repeatMode, currentFile } = store.getState();
    if (repeatMode === 'one' && currentFile) {
      // Repeat current track — a natural end-of-track should replay it,
      // but this does NOT apply when the user manually presses skip (see
      // QueueManager.smartNext, which intentionally has no repeat-one
      // special case so "skip" always advances, matching every
      // mainstream player's convention).
      playbackEngine.seek(0);
      playbackEngine.play();
      return;
    }
    store.getState().nextTrack();
  });
}

export const usePlayerStore = store;
