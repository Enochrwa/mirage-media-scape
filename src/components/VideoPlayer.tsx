
import React, { useRef, useEffect, useState } from 'react';
import { useMedia } from '@/contexts/MediaContext';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX, 
  Maximize, Minimize, Heart, Share2, BookmarkPlus, Globe, MoreHorizontal 
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface VideoPlayerProps {
  className?: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ className }) => {
  const {
    currentFile,
    isPlaying,
    togglePlayback,
    pausePlayback,
    resumePlayback,
    volume,
    setVolume,
    currentTime,
    duration,
    seekTo,
    nextTrack,
    previousTrack,
    updateCurrentTime,
    updateDuration,
    playlists
  } = useMedia();
  
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [mouseMovementTimeout, setMouseMovementTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  
  useEffect(() => {
    if (!videoRef.current || !currentFile || currentFile.type !== 'video') return;
    
    const video = videoRef.current;
    video.src = currentFile.file;
    video.volume = volume;
    
    if (isPlaying) {
      video.play().catch(error => {
        console.error("Error playing video:", error);
      });
    } else {
      video.pause();
    }
    
    return () => {
      video.pause();
    };
  }, [currentFile, isPlaying]);
  
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);
  
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      updateCurrentTime(videoRef.current.currentTime);
    }
  };
  
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      updateDuration(videoRef.current.duration);
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
    if (videoRef.current) {
      videoRef.current.currentTime = newValue[0];
    }
  };
  
  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    
    if (!isFullscreen) {
      if (videoContainerRef.current.requestFullscreen) {
        videoContainerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  const handleMouseMove = () => {
    setControlsVisible(true);
    
    if (mouseMovementTimeout) {
      clearTimeout(mouseMovementTimeout);
    }
    
    if (isPlaying) {
      const timeout = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
      
      setMouseMovementTimeout(timeout);
    }
  };
  
  const handleVideoClick = () => {
    togglePlayback();
  };
  
  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    toast({
      title: isFavorite ? "Removed from favorites" : "Added to favorites",
      description: `"${currentFile?.title}" has been ${isFavorite ? "removed from" : "added to"} your favorites.`,
    });
  };
  
  const handleShareClick = () => {
    navigator.clipboard.writeText(`Check out this awesome video: ${currentFile?.title} by ${currentFile?.artist}`);
    toast({
      title: "Share link copied!",
      description: "Share link has been copied to your clipboard.",
    });
  };
  
  const handleAddToPlaylist = (playlistId: string) => {
    if (currentFile) {
      toast({
        title: "Added to playlist",
        description: `"${currentFile.title}" has been added to the playlist.`,
      });
    }
  };
  
  const handleLanguageChange = (language: string) => {
    toast({
      title: "Language changed",
      description: `Player language changed to ${language}.`,
    });
  };
  
  if (!currentFile || currentFile.type !== 'video') return null;
  
  return (
    <Card 
      className={cn("relative overflow-hidden", className)}
      ref={videoContainerRef}
      onMouseMove={handleMouseMove}
    >
      <video
        ref={videoRef}
        className="w-full h-full bg-black cursor-pointer"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={nextTrack}
        onClick={handleVideoClick}
      />
      
      {controlsVisible && (
        <>
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <h3 className="font-medium">{currentFile.title}</h3>
                <p className="text-sm opacity-80">{currentFile.artist}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "hover:bg-white/10",
                    isFavorite ? "text-red-500" : "text-white"
                  )}
                  onClick={toggleFavorite}
                >
                  <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={handleShareClick}
                >
                  <Share2 size={20} />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/10"
                    >
                      <BookmarkPlus size={20} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Add to playlist</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {playlists.map(playlist => (
                      <DropdownMenuItem 
                        key={playlist.id}
                        onClick={() => handleAddToPlaylist(playlist.id)}
                      >
                        {playlist.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem>
                      Create new playlist
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/10"
                    >
                      <Globe size={20} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Change language</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleLanguageChange("English")}>
                      English
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleLanguageChange("Spanish")}>
                      Spanish
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleLanguageChange("French")}>
                      French
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleLanguageChange("German")}>
                      German
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleLanguageChange("Japanese")}>
                      Japanese
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/10"
                    >
                      <MoreHorizontal size={20} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Download</DropdownMenuItem>
                    <DropdownMenuItem>Report an issue</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/80 w-12">
                  {formatTime(currentTime)}
                </span>
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleProgressChange}
                  className="flex-1"
                />
                <span className="text-xs text-white/80 w-12 text-right">
                  {formatTime(duration)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={previousTrack} className="text-white hover:bg-white/10">
                    <SkipBack size={18} />
                  </Button>
                  
                  <Button 
                    size="icon" 
                    className="w-9 h-9 bg-white text-black hover:bg-white/90 rounded-full"
                    onClick={togglePlayback}
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </Button>
                  
                  <Button variant="ghost" size="icon" onClick={nextTrack} className="text-white hover:bg-white/10">
                    <SkipForward size={18} />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-white hover:bg-white/10"
                      onClick={handleVolumeClick}
                    >
                      <VolumeIcon />
                    </Button>
                    <Slider
                      value={[volume]}
                      max={1}
                      step={0.01}
                      onValueChange={handleVolumeChange}
                      className="w-20"
                    />
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white hover:bg-white/10"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default VideoPlayer;
