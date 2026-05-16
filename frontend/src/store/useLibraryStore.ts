import { create } from 'zustand';
import { MediaFile, Playlist } from '@/types/media';
import { API_BASE } from '@/lib/utils';
import { io, Socket } from 'socket.io-client';
import { openDB, IDBPDatabase } from 'idb';
import { getPlatform } from '../platform';
import { MobileMediaService } from '../services/mobileMedia/MobileMediaService';

export interface IncomingTrack {
  id: string;
  file_path: string;
  title: string;
  artist?: string | null;
  album?: string | null;
  cover_cache_path?: string | null;
  thumbnail_path?: string | null;
  genre?: string | null;
  year?: number | null;
  duration: number;
  bitrate?: number | null;
  sample_rate?: number | null;
  channels?: number | null;
  loudness?: number | null;
  bpm?: number | null;
  key?: string | null;
  camelot_key?: string | null;
  bpm_confidence?: number | null;
  file_type?: string | null;
  rating?: number | null;
  play_count?: number | null;
  replaygain_track_gain?: number | null;
  replaygain_track_peak?: number | null;
  replaygain_album_gain?: number | null;
  replaygain_album_peak?: number | null;
}

function resolveMediaType(
  track: Pick<IncomingTrack, 'file_path' | 'file_type'>,
): MediaFile['type'] {
  if (track.file_type === 'video') return 'video';
  if (track.file_type === 'audio') return 'audio';
  const p = (track.file_path || '').toLowerCase();
  if (/\.(mp4|mkv|avi|mov|webm|m4v|wmv)$/.test(p)) return 'video';
  return 'audio';
}

export function mapIncomingTrackToMediaFile(track: IncomingTrack): MediaFile {
  const type = resolveMediaType(track);
  return {
    missing: (track as unknown as { missing?: number }).missing,
    dominant_color: (track as unknown as { dominant_color?: string }).dominant_color,
    id: track.id,
    title: track.title,
    artist: track.artist ?? undefined,
    album: track.album ?? undefined,
    cover: track.cover_cache_path ? `${API_BASE}/api/tracks/cover/${track.id}` : undefined,
    thumbnail: track.thumbnail_path ? `${API_BASE}/api/tracks/thumbnail/${track.id}` : undefined,
    file: `${API_BASE}/api/tracks/stream?path=${encodeURIComponent(track.file_path)}`,
    file_path: track.file_path,
    type,
    duration: track.duration,
    loudness: track.loudness ?? undefined,
    bpm: track.bpm ?? undefined,
    camelot_key: track.camelot_key ?? undefined,
    key: track.key ?? undefined,
    genre: track.genre ?? undefined,
    year: track.year ?? undefined,
    bitrate: track.bitrate != null ? String(track.bitrate) : undefined,
    sampleRate: track.sample_rate != null ? String(track.sample_rate) : undefined,
    rating: track.rating ?? undefined,
    play_count: track.play_count ?? undefined,
    file_type: track.file_type ?? undefined,
    replaygain_track_gain: track.replaygain_track_gain ?? undefined,
    replaygain_track_peak: track.replaygain_track_peak ?? undefined,
    replaygain_album_gain: track.replaygain_album_gain ?? undefined,
    replaygain_album_peak: track.replaygain_album_peak ?? undefined,
  };
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
  folderHandles: FileSystemDirectoryHandle[];
  needsPermission: boolean;

  init: () => Promise<void>;
  requestFolderPermissions: () => Promise<void>;
  fetchInstantTracks: () => Promise<void>;
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
const HANDLES_STORE = 'handles';

async function persistTracksToIdb(db: IDBPDatabase, tracks: MediaFile[]) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.clear();
  for (const track of tracks) {
    await tx.store.put(track);
  }
  await tx.done;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  files: [],
  playlists: [],
  smartPlaylists: [],
  scanProgress: null,
  db: null,
  socket: null,
  folderHandles: [],
  needsPermission: false,

  init: async () => {
    const idb = await openDB(DB_NAME, 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          db.createObjectStore(HANDLES_STORE);
        }
      },
    });
    set({ db: idb });

    const { host } = getPlatform();

    if (host === 'web') {
      // Load handles and check permissions
      const handles = (await idb.getAll(HANDLES_STORE)) as FileSystemDirectoryHandle[];
      let needsPermission = false;
      if (handles.length > 0) {
        for (const handle of handles) {
          if (
            (await (
              handle as unknown as { queryPermission: (o: { mode: string }) => Promise<string> }
            ).queryPermission({
              mode: 'read',
            })) !== 'granted'
          ) {
            needsPermission = true;
            break;
          }
        }
        set({ folderHandles: handles, needsPermission });
        if (!needsPermission) {
          // Automatically start background refresh if permission is granted
          void get().fetchTracks();
        }
      }
    }

    const cachedTracks = (await idb.getAll(STORE_NAME)) as MediaFile[];
    if (cachedTracks.length > 0) {
      set({ files: cachedTracks });
    }

    if (host === 'desktop') {
      // Step B: Check when last scan ran
      try {
        const statsRes = await fetch(`${API_BASE}/api/scanner/stats`);
        const { data } = await statsRes.json();
        const lastScanAge = Date.now() - (data?.lastScanAt ?? 0);
        const ONE_HOUR = 60 * 60 * 1000;

        if (lastScanAge > ONE_HOUR || data?.totalTracks === 0) {
          // Trigger background auto-scan — don't block UI
          fetch(`${API_BASE}/api/scanner/auto-scan-defaults`, { method: 'POST' }).catch(
            console.error,
          );
        }
      } catch (e) {
        // Server offline — cached library still shows
        console.warn('[Desktop] Could not check scan status', e);
      }
    } else if (host === 'mobile') {
      // Query device OS media database directly
      // No server scan. No waiting.
      set({ scanProgress: { scanned: 0, total: 0, percentage: 0 } });

      const granted = await MobileMediaService.requestPermissions();
      if (granted) {
        const deviceMedia = await MobileMediaService.getAll();
        if (deviceMedia.length > 0) {
          set({ files: deviceMedia, scanProgress: null });
          // Persist to IDB so subsequent launches are instant
          if (idb) await persistTracksToIdb(idb, deviceMedia);
        } else {
          set({ scanProgress: null });
        }

        // VLC-style auto-refresh on app resume
        const { App } = await import('@capacitor/app');
        App.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            // App came to foreground — silently refresh media list
            const granted = await MobileMediaService.requestPermissions();
            if (granted) {
              const fresh = await MobileMediaService.getAll();
              if (fresh.length > 0) {
                set({ files: fresh });
                if (idb) await persistTracksToIdb(idb, fresh);
              }
            }
          }
        });
      } else {
        set({ scanProgress: null });
        // Show permission denied state in UI
        set({ needsPermission: true });
      }
    }

    let socket = get().socket;
    if (!socket) {
      socket = io(API_BASE.replace('/api', ''));
      set({ socket });

      socket.on('SCAN_START', (data: ScanStartData) => {
        set({ scanProgress: { scanned: 0, total: data.total, percentage: 0 } });
      });

      socket.on('SCAN_PROGRESS', (data: ScanProgressData) => {
        set({
          scanProgress: {
            scanned: data.scanned,
            total: data.total,
            percentage: data.total ? Math.round((data.scanned / data.total) * 100) : 0,
          },
        });
      });

      socket.on('NEW_TRACKS', (data: NewTracksData) => {
        set((state) => {
          const byId = new Map(state.files.map((f) => [f.id, f]));
          for (const track of data.tracks || []) {
            byId.set(track.id, mapIncomingTrackToMediaFile(track));
          }
          return { files: Array.from(byId.values()) };
        });
      });

      socket.on('SCAN_COMPLETE', () => {
        set({ scanProgress: null });
        void get().fetchTracks();
      });

      socket.on('LIBRARY_CHANGE', () => {
        void get().fetchInstantTracks();
      });
    }

    await get().fetchInstantTracks();
    void get().fetchTracks();
    await get().fetchSmartPlaylists();

    useLibraryStore.subscribe((state) => {
      (window as unknown as { libraryFiles: MediaFile[] }).libraryFiles = state.files;
    });
  },

  fetchInstantTracks: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tracks/instant`);
      if (!response.ok) return;
      const data = (await response.json()) as IncomingTrack[];
      const mapped = data.map(mapIncomingTrackToMediaFile);
      if (mapped.length > 0) {
        set({ files: mapped });
      }
    } catch (e) {
      console.error('Instant library fetch failed', e);
    }
  },

  fetchTracks: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tracks`);
      if (!response.ok) return;
      const data = (await response.json()) as IncomingTrack[];
      const mappedTracks: MediaFile[] = data.map(mapIncomingTrackToMediaFile);
      set({ files: mappedTracks });

      const idb = get().db;
      if (idb) {
        await persistTracksToIdb(idb, mappedTracks);
      }
    } catch (e) {
      console.error('Failed to fetch tracks', e);
    }
  },

  fetchSmartPlaylists: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/playlists/smart`);
      if (response.ok) {
        const json = await response.json();
        const data = json.data as Playlist[];
        set({ smartPlaylists: data });
      }
    } catch (error) {
      console.error('Failed to fetch smart playlists:', error);
    }
  },

  requestFolderPermissions: async () => {
    const handles = get().folderHandles;
    const idb = get().db;
    if (!idb) return;

    for (const handle of handles) {
      if (
        (await (
          handle as unknown as { requestPermission: (o: { mode: string }) => Promise<string> }
        ).requestPermission({
          mode: 'read',
        })) !== 'granted'
      ) {
        return;
      }
    }
    set({ needsPermission: false });
    void get().fetchTracks();
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
        const handle = await (
          window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
        ).showDirectoryPicker();
        if (handle) {
          const idb = get().db;
          if (idb) {
            await idb.put(HANDLES_STORE, handle, handle.name);
            set((state) => ({ folderHandles: [...state.folderHandles, handle] }));
            void get().fetchTracks();
          }
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
