import { create } from 'zustand';
import { MediaFile, Playlist } from '@/types/media';
import { API_BASE } from '@/lib/utils';
import { io, Socket } from 'socket.io-client';
import { openDB, IDBPDatabase } from 'idb';
import * as mm from 'music-metadata';

interface IncomingTrack {
  id: string;
  file_path: string;
  title: string;
  artist?: string;
  cover_cache_path?: string;
  genre?: string;
  year?: number;
}

interface LibraryState {
  files: MediaFile[];
  playlists: Playlist[];
  smartPlaylists: Playlist[];
  scanProgress: { scanned: number; total: number; percentage: number } | null;
  db: IDBPDatabase | null;
  socket: Socket | null;

  // Actions
  init: () => Promise<void>;
  fetchTracks: () => Promise<void>;
  fetchSmartPlaylists: () => Promise<void>;
  addFolder: (path?: string) => Promise<void>;
  createPlaylist: (name: string) => void;
  addToPlaylist: (playlistId: string, fileId: string) => void;
  removeFromPlaylist: (playlistId: string, fileId: string) => void;
}

const DB_NAME = 'sonic-web-db';
const STORE_NAME = 'tracks';

export const useLibraryStore = create<LibraryState>((set, get) => ({
  files: [],
  playlists: [],
  smartPlaylists: [],
  scanProgress: null,
  db: null,
  socket: null,

  init: async () => {
    // DB Init
    const db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      },
    });
    set({ db });

    const cachedTracks = await db.getAll(STORE_NAME);
    if (cachedTracks.length > 0) {
      set({ files: cachedTracks });
    }

    // Socket Init
    const socket = io(API_BASE.replace('/api', ''));
    set({ socket });

    socket.on('SCAN_START', (data) => {
      set({ scanProgress: { scanned: 0, total: data.total, percentage: 0 } });
    });

    socket.on('SCAN_PROGRESS', (data) => {
      set({
        scanProgress: {
          scanned: data.scanned,
          total: data.total,
          percentage: Math.round((data.scanned / data.total) * 100),
        },
      });
    });

    socket.on('NEW_TRACKS', (data) => {
      set((state) => {
        const newFiles = [...state.files];
        const tracks = (data.tracks as IncomingTrack[]) || [];
        tracks.forEach((track) => {
          if (!newFiles.find((f) => f.id === track.id)) {
            newFiles.push({
              ...track,
              file: `${API_BASE}/api/tracks/stream?path=${encodeURIComponent(track.file_path)}`,
              type: 'audio',
            });
          }
        });
        return { files: newFiles };
      });
    });

    socket.on('SCAN_COMPLETE', () => {
      set({ scanProgress: null });
    });

    // Initial fetch
    await get().fetchTracks();
    await get().fetchSmartPlaylists();
  },

  fetchTracks: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tracks`);
      if (response.ok) {
        const data = (await response.json()) as IncomingTrack[];
        const mappedTracks = data.map((track) => ({
          ...track,
          file: `${API_BASE}/api/tracks/stream?path=${encodeURIComponent(track.file_path)}`,
          type:
            track.file_path.endsWith('.mp4') || track.file_path.endsWith('.mkv')
              ? 'video'
              : 'audio',
        }));
        set({ files: mappedTracks });
      }
    } catch (e) {
      console.error('Failed to fetch tracks', e);
    }
  },

  fetchSmartPlaylists: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/playlists/smart`);
      if (response.ok) {
        const data = await response.json();
        set({ smartPlaylists: data });
      }
    } catch (error) {
      console.error('Failed to fetch smart playlists:', error);
    }
  },

  addFolder: async (path) => {
    if (path) {
      await fetch(`${API_BASE}/api/scanner/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: path }),
      });
    } else if ('showDirectoryPicker' in window) {
      try {
        const win = window as Window & {
          showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
        };
        const handle = await win.showDirectoryPicker?.();
        // Here we would ideally scan the directory in the web context
        // This logic is complex, for now let's keep it consistent with MediaContext
        console.log('Web directory picker not fully implemented in store yet');
      } catch (e) {
        console.error('Directory picker failed', e);
      }
    }
  },

  createPlaylist: (name) => {
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      files: [],
    };
    set((state) => ({ playlists: [...state.playlists, newPlaylist] }));
  },

  addToPlaylist: (playlistId, fileId) => {
    const file = get().files.find((f) => f.id === fileId);
    if (!file) return;

    set((state) => ({
      playlists: state.playlists.map((playlist) => {
        if (playlist.id === playlistId && !playlist.files.some((f) => f.id === fileId)) {
          return { ...playlist, files: [...playlist.files, file] };
        }
        return playlist;
      }),
    }));
  },

  removeFromPlaylist: (playlistId, fileId) => {
    set((state) => ({
      playlists: state.playlists.map((playlist) => {
        if (playlist.id === playlistId) {
          return { ...playlist, files: playlist.files.filter((f) => f.id !== fileId) };
        }
        return playlist;
      }),
    }));
  },
}));
