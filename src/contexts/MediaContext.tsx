
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { playbackEngine } from '@/lib/PlaybackEngine';

export type MediaType = 'audio' | 'video';

export interface MediaFile {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  cover?: string;
  file: string;
  type: MediaType;
  duration?: number;
  loudness?: number;
}

export interface Playlist {
  id: string;
  name: string;
  files: MediaFile[];
}

interface MediaContextType {
  files: MediaFile[];
  playlists: Playlist[];
  currentFile: MediaFile | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  addFile: (file: MediaFile) => void;
  removeFile: (id: string) => void;
  createPlaylist: (name: string) => void;
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

// Sample data
const sampleAudio: MediaFile[] = [
  {
    id: '1',
    title: 'Electric Dreams',
    artist: 'Synthwave Artist',
    album: 'Retro Futures',
    cover: '/placeholder.svg',
    file: 'https://storage.googleapis.com/media-session/elephants-dream/the-wires.mp3',
    type: 'audio',
    duration: 214,
    bpm: 124,
    camelot_key: '8A'
  },
  {
    id: '2',
    title: 'Neon Twilight',
    artist: 'Digital Rain',
    album: 'Cyber City',
    cover: '/placeholder.svg',
    file: 'https://storage.googleapis.com/media-session/elephants-dream/the-wires.mp3',
    type: 'audio',
    duration: 187
  }
];

const sampleVideo: MediaFile[] = [
  {
    id: '3',
    title: 'Cosmic Journey',
    artist: 'Visual Arts',
    cover: '/placeholder.svg',
    file: 'https://storage.googleapis.com/media-session/elephants-dream/progressive-hevc.mp4',
    type: 'video',
    duration: 280
  }
];

const samplePlaylists: Playlist[] = [
  {
    id: 'playlist-1',
    name: 'Favorites',
    files: [sampleAudio[0], sampleVideo[0]]
  },
  {
    id: 'playlist-2',
    name: 'Chill Vibes',
    files: [sampleAudio[1]]
  }
];

export const MediaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<MediaFile[]>([...sampleAudio, ...sampleVideo]);
  const [playlists, setPlaylists] = useState<Playlist[]>(samplePlaylists);
  const [currentFile, setCurrentFile] = useState<MediaFile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayerFullscreen, setPlayerFullscreen] = useState(false);
  
  const addFile = (file: MediaFile) => {
    setFiles(prev => [...prev, file]);
  };
  
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
    setPlaylists(prev => prev.map(playlist => ({
      ...playlist,
      files: playlist.files.filter(file => file.id !== id)
    })));
    
    if (currentFile?.id === id) {
      setCurrentFile(null);
      setIsPlaying(false);
    }
  };
  
  const createPlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      files: []
    };
    
    setPlaylists(prev => [...prev, newPlaylist]);
  };
  
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
        // Decode in the background
        const audioBuffer = await (playbackEngine as any).ctx.decodeAudioData(arrayBuffer);
        playbackEngine.play(audioBuffer, 0, file.loudness);

        // Preload next track if available
        const currentIndex = files.findIndex(f => f.id === file.id);
        if (currentIndex < files.length - 1) {
          playbackEngine.preloadNext(files[currentIndex + 1].file);
        }
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
  
  const togglePlayback = () => {
    if (currentFile) {
      const nextState = !isPlaying;
      setIsPlaying(nextState);
      if (nextState) {
        playbackEngine.resume();
      } else {
        playbackEngine.pause();
      }
    }
  };
  
  const seekTo = (time: number) => {
    setCurrentTime(time);
  };
  
  const setVolume = (newVolume: number) => {
    setVolumeState(newVolume);
  };
  
  const findCurrentFileIndex = () => {
    if (!currentFile) return -1;
    return files.findIndex(file => file.id === currentFile.id);
  };
  
  const nextTrack = () => {
    const currentIndex = findCurrentFileIndex();
    if (currentIndex < 0 || currentIndex >= files.length - 1) return;
    
    playFile(files[currentIndex + 1]);
  };
  
  const previousTrack = () => {
    const currentIndex = findCurrentFileIndex();
    if (currentIndex <= 0) return;
    
    playFile(files[currentIndex - 1]);
  };
  
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
        { src: currentFile.cover || '/placeholder.svg', sizes: '96x96', type: 'image/svg+xml' },
        { src: currentFile.cover || '/placeholder.svg', sizes: '512x512', type: 'image/svg+xml' },
      ]
    });

    navigator.mediaSession.setActionHandler('play', resumePlayback);
    navigator.mediaSession.setActionHandler('pause', pausePlayback);
    navigator.mediaSession.setActionHandler('previoustrack', previousTrack);
    navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) seekTo(details.seekTime);
    });

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('seekto', null);
    };
  }, [currentFile]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
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
    currentFile,
    isPlaying,
    volume,
    currentTime,
    duration,
    addFile,
    removeFile,
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
