
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { API_BASE } from '@/lib/utils';
import { io, Socket } from 'socket.io-client';
import { openDB, IDBPDatabase } from 'idb';
import * as mm from 'music-metadata';

export type MediaType = 'audio' | 'video';

export interface MediaFile {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  cover?: string;
  file: string; // This can be a path or an object URL/blob URL
  type: MediaType;
  duration?: number;
  loudness?: number;
  bpm?: number;
  camelot_key?: string;
  file_path?: string;
}

export interface Playlist {
  id: string;
  name: string;
  files: MediaFile[];
  rules?: any;
}

interface MediaContextType {
  files: MediaFile[];
  playlists: Playlist[];
  smartPlaylists: Playlist[];
  currentFile: MediaFile | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  scanProgress: { scanned: number, total: number, percentage: number } | null;
  addFolder: () => Promise<void>;
  createPlaylist: (name: string) => void;
  fetchSmartPlaylists: () => Promise<void>;
  addToPlaylist: (playlistId: string, fileId: string) => void;
  removeFromPlaylist: (playlistId: string, fileId: string) => void;
  playFile: (file: MediaFile) => void;
  pausePlayback: () => void;
  resumePlayback: () => void;
  togglePlayback: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  updateCurrentTime: (time: number) => void;
  updateDuration: (duration: number) => void;
  isPlayerFullscreen: boolean;
  setPlayerFullscreen: (fullscreen: boolean) => void;
  closePlayer: () => void;
}

export const MediaContext = createContext<MediaContextType | undefined>(undefined);

const DB_NAME = 'sonic-web-db';
const STORE_NAME = 'tracks';

export const MediaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [smartPlaylists, setSmartPlaylists] = useState<Playlist[]>([]);
  const [currentFile, setCurrentFile] = useState<MediaFile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayerFullscreen, setPlayerFullscreen] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ scanned: number, total: number, percentage: number } | null>(null);
  const [db, setDb] = useState<IDBPDatabase | null>(null);

  // Initialize DB
  useEffect(() => {
    const initDb = async () => {
      const database = await openDB(DB_NAME, 1, {
        upgrade(db) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        },
      });
      setDb(database);

      // Load cached tracks
      const cachedTracks = await database.getAll(STORE_NAME);
      if (cachedTracks.length > 0) {
        setFiles(cachedTracks);
      }
    };
    initDb();
  }, []);

  // Native WebSocket setup
  useEffect(() => {
    const socket: Socket = io(API_BASE.replace('/api', ''));

    socket.on('SCAN_START', (data) => {
        setScanProgress({ scanned: 0, total: data.total, percentage: 0 });
    });

    socket.on('SCAN_PROGRESS', (data) => {
        setScanProgress({
            scanned: data.scanned,
            total: data.total,
            percentage: Math.round((data.scanned / data.total) * 100)
        });
    });

    socket.on('NEW_TRACKS', (data) => {
        setFiles(prev => {
            const newFiles = [...prev];
            data.tracks.forEach((track: any) => {
                if (!newFiles.find(f => f.id === track.id)) {
                    newFiles.push({
                        ...track,
                        file: `${API_BASE}/api/tracks/stream?path=${encodeURIComponent(track.file_path)}`,
                        type: 'audio' // Default for now
                    });
                }
            });
            return newFiles;
        });
    });

    socket.on('SCAN_COMPLETE', () => {
        setScanProgress(null);
    });

    return () => {
        socket.disconnect();
    };
  }, []);

  // Initial load from backend (Native)
  useEffect(() => {
    const fetchNativeTracks = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/tracks`);
            if (response.ok) {
                const data = await response.json();
                const mappedTracks = data.map((track: any) => ({
                    ...track,
                    file: `${API_BASE}/api/tracks/stream?path=${encodeURIComponent(track.file_path)}`,
                    type: track.file_path.endsWith('.mp4') || track.file_path.endsWith('.mkv') ? 'video' : 'audio'
                }));
                setFiles(mappedTracks);
            }
        } catch (e) {
            console.error('Failed to fetch native tracks', e);
        }
    };
    fetchNativeTracks();
  }, []);

  const addFolder = async () => {
    // Native path (handled by Tauri if applicable, but here we just prompt for a path)
    // For this environment, we'll implement both Web and a mock Native folder add.

    if ('showDirectoryPicker' in window) {
        try {
            const handle = await (window as any).showDirectoryPicker();
            // Store handle in IndexedDB for persistence
            // Web implementation: scan handles
            await scanWebDirectory(handle);
        } catch (e) {
            console.error('Directory picker failed', e);
        }
    } else {
        // Native fallback: prompt for string path
        const path = prompt("Enter media folder path:");
        if (path) {
            await fetch(`${API_BASE}/api/scanner/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ directory: path })
            });
        }
    }
  };

  const scanWebDirectory = async (handle: any) => {
    const tracks: MediaFile[] = [];
    
    async function walk(h: any) {
        for await (const entry of h.values()) {
            if (entry.kind === 'directory') {
                await walk(entry);
            } else if (entry.kind === 'file') {
                const file = await entry.getFile();
                if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
                    const id = btoa(entry.name + file.lastModified + file.size);

                    // Check cache
                    if (db) {
                        const cached = await db.get(STORE_NAME, id);
                        if (cached) {
                            tracks.push({ ...cached, file: URL.createObjectURL(file) });
                            continue;
                        }
                    }

                    try {
                        const metadata = await mm.parseBlob(file);
                        const track: MediaFile = {
                            id,
                            title: metadata.common.title || entry.name,
                            artist: metadata.common.artist || 'Unknown Artist',
                            album: metadata.common.album || 'Unknown Album',
                            duration: metadata.format.duration,
                            file: URL.createObjectURL(file),
                            type: file.type.startsWith('video/') ? 'video' : 'audio',
                            cover: metadata.common.picture?.[0] ? URL.createObjectURL(new Blob([metadata.common.picture[0].data], { type: metadata.common.picture[0].format })) : undefined
                        };
                        tracks.push(track);
                        if (db) await db.put(STORE_NAME, track);
                    } catch (e) {
                        console.error('Failed to parse metadata for', entry.name, e);
                    }
                }
            }
        }
    }

    await walk(handle);
    setFiles(prev => [...prev, ...tracks]);
  };

  const createPlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      files: []
    };
    setPlaylists(prev => [...prev, newPlaylist]);
  };

  const fetchSmartPlaylists = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/playlists/smart`);
      if (response.ok) {
        const data = await response.json();
        setSmartPlaylists(data);
      }
    } catch (error) {
      console.error('Failed to fetch smart playlists:', error);
    }
  };

  useEffect(() => {
    fetchSmartPlaylists();
  }, []);
  
  const addToPlaylist = (playlistId: string, fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    
    setPlaylists(prev => prev.map(playlist => {
      if (playlist.id === playlistId) {
        if (!playlist.files.some(f => f.id === fileId)) {
          return {
            ...playlist,
            files: [...playlist.files, file]
          };
        }
      }
      return playlist;
    }));
  };
  
  const removeFromPlaylist = (playlistId: string, fileId: string) => {
    setPlaylists(prev => prev.map(playlist => {
      if (playlist.id === playlistId) {
        return {
          ...playlist,
          files: playlist.files.filter(file => file.id !== fileId)
        };
      }
      return playlist;
    }));
  };
  
  const playFile = async (file: MediaFile) => {
    setCurrentFile(file);
    setIsPlaying(true);

    if (file.type === 'audio') {
      try {
        const response = await fetch(file.file);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await (playbackEngine as any).ctx.decodeAudioData(arrayBuffer);
        playbackEngine.play(audioBuffer, 0, file.loudness);
      } catch (error) {
        console.error('Playback Engine Error:', error);
      }
    }
  };

  const closePlayer = () => {
    setCurrentFile(null);
    setIsPlaying(false);
  };
  
  const pausePlayback = () => {
    setIsPlaying(false);
    playbackEngine.pause();
  };
  
  const resumePlayback = () => {
    if (currentFile) {
      setIsPlaying(true);
      playbackEngine.resume();
    }
  };
  
  const togglePlayback = useCallback(() => {
    if (currentFile) {
      const nextState = !isPlaying;
      setIsPlaying(nextState);
      if (nextState) {
        playbackEngine.resume();
      } else {
        playbackEngine.pause();
      }
    }
  }, [currentFile, isPlaying]);
  
  const seekTo = (time: number) => {
    setCurrentTime(time);
  };
  
  const setVolume = (newVolume: number) => {
    setVolumeState(newVolume);
    playbackEngine.setVolume(newVolume);
  };
  
  const nextTrack = useCallback(() => {
    const currentIndex = files.findIndex(file => file.id === currentFile?.id);
    if (currentIndex < 0 || currentIndex >= files.length - 1) return;
    playFile(files[currentIndex + 1]);
  }, [files, currentFile]);
  
  const previousTrack = useCallback(() => {
    const currentIndex = files.findIndex(file => file.id === currentFile?.id);
    if (currentIndex <= 0) return;
    playFile(files[currentIndex - 1]);
  }, [files, currentFile]);
  
  const updateCurrentTime = (time: number) => {
    setCurrentTime(time);
  };
  
  const updateDuration = (newDuration: number) => {
    setDuration(newDuration);
  };
  
  // Media Session API integration
  useEffect(() => {
    if (!currentFile || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentFile.title,
      artist: currentFile.artist,
      album: currentFile.album,
      artwork: [
        { src: currentFile.cover || '/placeholder.svg', sizes: '512x512' },
      ]
    });

    navigator.mediaSession.setActionHandler('play', resumePlayback);
    navigator.mediaSession.setActionHandler('pause', pausePlayback);
    navigator.mediaSession.setActionHandler('previoustrack', previousTrack);
    navigator.mediaSession.setActionHandler('nexttrack', nextTrack);

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [currentFile, nextTrack, previousTrack]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayback();
          break;
        case 'ArrowRight':
          if (e.ctrlKey || e.metaKey) nextTrack();
          break;
        case 'ArrowLeft':
          if (e.ctrlKey || e.metaKey) previousTrack();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayback, nextTrack, previousTrack]);

  const value = {
    files,
    playlists,
    smartPlaylists,
    fetchSmartPlaylists,
    currentFile,
    isPlaying,
    volume,
    currentTime,
    duration,
    scanProgress,
    addFolder,
    createPlaylist,
    addToPlaylist,
    removeFromPlaylist,
    playFile,
    pausePlayback,
    resumePlayback,
    togglePlayback,
    seekTo,
    setVolume,
    nextTrack,
    previousTrack,
    updateCurrentTime,
    updateDuration,
    isPlayerFullscreen,
    setPlayerFullscreen,
    closePlayer
  };
  
  return (
    <MediaContext.Provider value={value}>
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = (): MediaContextType => {
  const context = useContext(MediaContext);
  if (context === undefined) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
};
