
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

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
  showPlayer: boolean;
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
    duration: 214
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
  const [showPlayer, setShowPlayer] = useState(false);
  const [isPlayerFullscreen, setPlayerFullscreen] = useState(false);
  
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  
  useEffect(() => {
    // Initialize audio element
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
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
  
  const playFile = (file: MediaFile) => {
    if (currentFile && currentFile.id === file.id) {
      resumePlayback();
      return;
    }
    
    setCurrentFile(file);
    setShowPlayer(true);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    // Audio handling
    if (file.type === 'audio') {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = file.file;
      audioRef.current.volume = volume;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Error playing audio:', err);
        setIsPlaying(false);
      });
    }
    
    // Video is handled by the VideoPlayer component
    if (file.type === 'video') {
      setIsPlaying(true);
    }
  };
  
  const pausePlayback = () => {
    if (currentFile?.type === 'audio' && audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };
  
  const resumePlayback = () => {
    if (currentFile?.type === 'audio' && audioRef.current) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Error resuming audio:', err);
          setIsPlaying(false);
        });
    } else if (currentFile?.type === 'video') {
      setIsPlaying(true);
    }
  };
  
  const togglePlayback = () => {
    if (isPlaying) {
      pausePlayback();
    } else {
      resumePlayback();
    }
  };
  
  const seekTo = (time: number) => {
    setCurrentTime(time);
    if (currentFile?.type === 'audio' && audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };
  
  const setVolume = (newVolume: number) => {
    setVolumeState(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
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
  
  const value = {
    files,
    playlists,
    currentFile,
    isPlaying,
    volume,
    currentTime,
    duration,
    showPlayer,
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
    setPlayerFullscreen
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
