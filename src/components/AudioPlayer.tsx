
import React, { useRef, useEffect, useState } from 'react';
import { useMedia } from '@/contexts/MediaContext';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX, Repeat, Shuffle } from 'lucide-react';
import AudioVisualizer from '@/components/AudioVisualizer';

interface AudioPlayerProps {
  className?: string;
  minimized?: boolean;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ className, minimized = false }) => {
  const {
    currentFile,
    isPlaying,
    togglePlayback,
    volume,
    setVolume,
    currentTime,
    duration,
    seekTo,
    nextTrack,
    previousTrack,
    updateCurrentTime,
    updateDuration
  } = useMedia();
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  
  useEffect(() => {
    if (!audioRef.current || !currentFile || currentFile.type !== 'audio') return;
    
    const audio = audioRef.current;
    audio.src = currentFile.file;
    audio.volume = volume;
    
    if (isPlaying) {
      audio.play().catch(error => {
        console.error("Error playing audio:", error);
      });
    } else {
      audio.pause();
    }
    
    return () => {
      audio.pause();
    };
  }, [currentFile, isPlaying]);
  
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);
  
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      updateCurrentTime(audioRef.current.currentTime);
    }
  };
  
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      updateDuration(audioRef.current.duration);
    }
  };
  
  const handleVolumeClick = () => {
    if (muted) {
      setMuted(false);
      setVolume(prevVolume);
    } else {
      setPrevVolume(volume);
      setMuted(true);
      setVolume(0);
    }
  };
  
  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0];
    setVolume(vol);
    if (vol > 0 && muted) {
      setMuted(false);
    } else if (vol === 0) {
      setMuted(true);
    }
  };
  
  const VolumeIcon = () => {
    if (muted || volume === 0) return <VolumeX size={18} />;
    if (volume < 0.5) return <Volume1 size={18} />;
    return <Volume2 size={18} />;
  };
  
  const handleProgressChange = (newValue: number[]) => {
    seekTo(newValue[0]);
  };
  
  if (!currentFile || currentFile.type !== 'audio') return null;
  
  if (minimized) {
    return (
      <div className={cn("flex items-center gap-3 p-2", className)}>
        <img 
          src={currentFile.cover || '/placeholder.svg'} 
          alt={currentFile.title} 
          className="w-10 h-10 rounded-md object-cover"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{currentFile.title}</p>
          <p className="text-xs text-muted-foreground truncate">{currentFile.artist}</p>
        </div>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={togglePlayback}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </Button>
        
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={nextTrack}
        />
      </div>
    );
  }
  
  return (
    <Card className={cn("flex flex-col p-4 gap-4 glassmorphic", className)}>
      <div className="flex items-center gap-4">
        <img 
          src={currentFile.cover || '/placeholder.svg'} 
          alt={currentFile.title} 
          className="w-16 h-16 rounded-md object-cover shadow-lg"
        />
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold truncate">{currentFile.title}</p>
          <p className="text-sm text-muted-foreground truncate">{currentFile.artist}</p>
        </div>
      </div>
      
      <div className="w-full h-24">
        <AudioVisualizer isPlaying={isPlaying} />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-10">
            {formatTime(currentTime)}
          </span>
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleProgressChange}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-10 text-right">
            {formatTime(duration)}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
            <Shuffle size={18} />
          </Button>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={previousTrack}>
              <SkipBack size={20} />
            </Button>
            
            <Button 
              size="icon" 
              className="w-10 h-10 bg-accent hover:bg-accent/90 rounded-full"
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </Button>
            
            <Button variant="ghost" size="icon" onClick={nextTrack}>
              <SkipForward size={20} />
            </Button>
          </div>
          
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
            <Repeat size={18} />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-white"
            onClick={handleVolumeClick}
          >
            <VolumeIcon />
          </Button>
          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="w-24"
          />
        </div>
      </div>
      
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={nextTrack}
      />
    </Card>
  );
};

export default AudioPlayer;
