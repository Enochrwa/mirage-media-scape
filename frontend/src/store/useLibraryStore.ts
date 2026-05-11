import { create } from 'zustand';
import { MediaFile, Playlist } from '@/types/media';
import { API_BASE } from '@/lib/utils';
import { io, Socket } from 'socket.io-client';
import { openDB, IDBPDatabase } from 'idb';

interface IncomingTrack {
  id: string;
  file_path: string;
  title: string;
  artist: string | null;
  album: string | null;
  cover_cache_path: string | null;
  genre: string | null;
  year: number | null;
  duration: number;
  bitrate: number | null;
  sample_rate: number | null;
  channels: number | null;
  loudness: number | null;
  bpm: number | null;
  key: string | null;
  camelot_key: string | null;
  bpm_confidence: number | null;
}

interface ScanStartData {
  total: number;
}

interface ScanProgressData {
  scanned: number;
  total: number;
}

interface NewTracksData {
  tracks: IncomingTrack[];
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
  addFile: (file: MediaFile) => void;
  createPlaylist: (name: string) => void;
  addToPlaylist: (playlistId: string, fileId: string) => void;
  removeFromPlaylist: (playlistId: string, fileId: string) => void;
}

const DB_NAME = 'zovyra-web-db';
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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
    set({ db });

    const cachedTracks = (await db.getAll(STORE_NAME)) as MediaFile[];
    if (cachedTracks.length > 0) {
      set({ files: cachedTracks });
    }

    // Socket Init
    const socket = io(API_BASE.replace('/api', ''));
    set({ socket });

    socket.on('SCAN_START', (data: ScanStartData) => {
      set({ scanProgress: { scanned: 0, total: data.total, percentage: 0 } });
    });

    socket.on('SCAN_PROGRESS', (data: ScanProgressData) => {
      set({
        scanProgress: {
          scanned: data.scanned,
          total: data.total,
          percentage: Math.round((data.scanned / data.total) * 100),
        },
      });
    });

    socket.on('NEW_TRACKS', (data: NewTracksData) => {
      set((state) => {
        const newFiles = [...state.files];
        const tracks = data.tracks || [];
        tracks.forEach((track) => {
          if (!newFiles.find((f) => f.id === track.id)) {
            const mediaFile: MediaFile = {
              id: track.id,
              title: track.title,
              artist: track.artist,
              album: track.album,
              cover: track.cover_cache_path ? `${API_BASE}/api/tracks/cover/${track.id}` : null,
              file: `${API_BASE}/api/tracks/stream?path=${encodeURIComponent(track.file_path)}`,
              file_path: track.file_path,
              type:
                track.file_path.endsWith('.mp4') || track.file_path.endsWith('.mkv')
                  ? 'video'
                  : 'audio',
              duration: track.duration,
              loudness: track.loudness,
              bpm: track.bpm,
              camelot_key: track.camelot_key,
              key: track.key,
              genre: track.genre,
              year: track.year,
              bitrate: track.bitrate,
              sampleRate: track.sample_rate,
            };
            newFiles.push(mediaFile);
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
        const mappedTracks: MediaFile[] = data.map((track) => ({
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          cover: track.cover_cache_path ? `${API_BASE}/api/tracks/cover/${track.id}` : null,
          file: `${API_BASE}/api/tracks/stream?path=${encodeURIComponent(track.file_path)}`,
          file_path: track.file_path,
          type:
            track.file_path.endsWith('.mp4') || track.file_path.endsWith('.mkv')
              ? 'video'
              : 'audio',
          duration: track.duration,
          loudness: track.loudness,
          bpm: track.bpm,
          camelot_key: track.camelot_key,
          key: track.key,
          genre: track.genre,
          year: track.year,
          bitrate: track.bitrate,
          sampleRate: track.sample_rate,
        }));
        set({ files: mappedTracks });

        // Cache to IDB
        const db = get().db;
        if (db) {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          await tx.store.clear();
          for (const track of mappedTracks) {
            await tx.store.put(track);
          }
          await tx.done;
        }
      }
    } catch (e) {
      console.error('Failed to fetch tracks', e);
    }
  },

  fetchSmartPlaylists: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/playlists/smart`);
      if (response.ok) {
        const data = (await response.json()) as Playlist[];
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
        const win = window as unknown as { showDirectoryPicker: () => Promise<void> };
        if (win.showDirectoryPicker) {
          await win.showDirectoryPicker();
          console.log('Web directory picker not fully implemented in store yet');
        }
      } catch (e) {
        console.error('Directory picker failed', e);
      }
    }
  },

  addFile: (file) => {
    set((state) => ({ files: [...state.files, file] }));
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
