import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX, 
  Repeat, Shuffle, Heart, Share2, BookmarkPlus, MoreHorizontal, 
  Globe, Mic, Radio, Headphones, Settings, Zap, Music, Waves,
  Timer, Clock, Rewind, FastForward, Download, Upload, Star,
  TrendingUp, Activity, Sparkles, Eye, EyeOff, RotateCcw,
  Wind, Sun, Moon, Palette, Filter, SlidersHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

// Mock data for demonstration
const mockCurrentFile = {
  title: "Starlight Symphony",
  artist: "Cosmic Orchestra",
  album: "Celestial Sounds",
  cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop",
  file: "https://www.soundjay.com/misc/sounds-667.mp3",
  type: 'audio',
  duration: 245,
  genre: "Electronic",
  year: 2024,
  bitrate: "320 kbps",
  sampleRate: "44.1 kHz"
};

const mockPlaylists = [
  { id: '1', name: 'Favorites' },
  { id: '2', name: 'Chill Vibes' },
  { id: '3', name: 'Workout Mix' },
];

interface AudioPlayerProps {
  className?: string;
  minimized?: boolean;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Advanced Audio Visualizer Component
const AdvancedVisualizer: React.FC<{ isPlaying: boolean; mode: string; intensity: number }> = ({ 
  isPlaying, 
  mode, 
  intensity 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [bars] = useState(() => Array(64).fill(0).map(() => Math.random() * 100));

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (isPlaying) {
        bars.forEach((bar, i) => {
          bars[i] = Math.max(5, bars[i] + (Math.random() - 0.5) * 20 * intensity);
          if (bars[i] > 100) bars[i] = 100;
        });
      } else {
        bars.forEach((bar, i) => {
          bars[i] = Math.max(0, bars[i] - 2);
        });
      }

      const barWidth = canvas.width / bars.length;
      
      bars.forEach((height, i) => {
        const x = i * barWidth;
        const normalizedHeight = (height / 100) * canvas.height;
        
        // Create gradient based on mode
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - normalizedHeight);
        switch (mode) {
          case 'cosmic':
            gradient.addColorStop(0, '#8B5CF6');
            gradient.addColorStop(0.5, '#06B6D4');
            gradient.addColorStop(1, '#10B981');
            break;
          case 'fire':
            gradient.addColorStop(0, '#F59E0B');
            gradient.addColorStop(0.5, '#EF4444');
            gradient.addColorStop(1, '#DC2626');
            break;
          case 'ocean':
            gradient.addColorStop(0, '#0EA5E9');
            gradient.addColorStop(0.5, '#3B82F6');
            gradient.addColorStop(1, '#1E40AF');
            break;
          default:
            gradient.addColorStop(0, '#6366F1');
            gradient.addColorStop(1, '#8B5CF6');
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - normalizedHeight, barWidth - 1, normalizedHeight);
        
        // Add glow effect
        ctx.shadowColor = gradient;
        ctx.shadowBlur = 10;
        ctx.fillRect(x, canvas.height - normalizedHeight, barWidth - 1, normalizedHeight);
        ctx.shadowBlur = 0;
      });

      if (isPlaying) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, mode, intensity, bars]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={100}
      className="w-full h-full rounded-lg"
      style={{ background: 'rgba(0,0,0,0.1)' }}
    />
  );
};

// Spectrum Analyzer Component
const SpectrumAnalyzer: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
  const [frequencies] = useState(() => Array(32).fill(0).map(() => Math.random() * 50));

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      frequencies.forEach((_, i) => {
        frequencies[i] = Math.random() * 50;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, frequencies]);

  return (
    <div className="flex items-end justify-center gap-1 h-16 px-4">
      {frequencies.map((height, i) => (
        <div
          key={i}
          className="bg-gradient-to-t from-purple-600 to-cyan-400 rounded-t-sm transition-all duration-150"
          style={{
            width: '4px',
            height: isPlaying ? `${Math.max(4, height)}%` : '4px',
          }}
        />
      ))}
    </div>
  );
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ className, minimized = false }) => {
  // Core player state
  const [currentFile] = useState(mockCurrentFile);
  const [playlists] = useState(mockPlaylists);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(67);
  const [duration] = useState(245);
  const [muted, setMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  
  // Enhanced features state
  const [isFavorite, setIsFavorite] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [sleepTimer, setSleepTimer] = useState(0);
  const [crossfadeEnabled, setCrossfadeEnabled] = useState(false);
  const [bassBoost, setBassBoost] = useState(0);
  const [trebleBoost, setTrebleBoost] = useState(0);
  const [surroundSound, setSurroundSound] = useState(false);
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [autoGain, setAutoGain] = useState(true);
  const [visualizerMode, setVisualizerMode] = useState('cosmic');
  const [visualizerIntensity, setVisualizerIntensity] = useState(0.7);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [ambientMode, setAmbientMode] = useState(false);
  const [particleEffect, setParticleEffect] = useState(true);
  const [moodLighting, setMoodLighting] = useState('auto');
  const [rating, setRating] = useState(0);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const [recordingMode, setRecordingMode] = useState(false);
  
  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();

  // Simulate audio time updates
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        if (prev >= duration) {
          if (repeat) return 0;
          setIsPlaying(false);
          return duration;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, duration, repeat]);

  const togglePlayback = () => setIsPlaying(!isPlaying);

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
    setCurrentTime(newValue[0]);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  const handleSleepTimer = (minutes: number) => {
    setSleepTimer(minutes);
    if (minutes > 0) {
      setTimeout(() => {
        setIsPlaying(false);
        setSleepTimer(0);
      }, minutes * 60 * 1000);
    }
  };

  const showToast = (message: string) => {
    // Mock toast notification
    console.log('Toast:', message);
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    showToast(isFavorite ? "Removed from favorites" : "Added to favorites");
  };

  if (minimized) {
    return (
      <div className={cn("flex items-center gap-3 p-3 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-xl backdrop-blur-sm border border-white/10", className)}>
        <div className="relative">
          <img 
            src={currentFile.cover} 
            alt={currentFile.title} 
            className="w-12 h-12 rounded-lg object-cover shadow-lg"
          />
          {particleEffect && isPlaying && (
            <div className="absolute inset-0 rounded-lg bg-gradient-to-tr from-purple-500/20 to-cyan-500/20 animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate text-white">{currentFile.title}</p>
          <p className="text-xs text-gray-300 truncate">{currentFile.artist}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={togglePlayback}
            className="hover:bg-white/10 text-white"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </Button>
          {showSpectrum && <SpectrumAnalyzer isPlaying={isPlaying} />}
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(
      "relative overflow-hidden",
      "bg-gradient-to-br from-slate-900/95 via-purple-900/30 to-cyan-900/30",
      "backdrop-blur-xl border border-white/20 shadow-2xl",
      ambientMode && "ring-2 ring-purple-500/50 shadow-purple-500/25",
      className
    )}>
      {/* Ambient lighting effect */}
      {ambientMode && (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-cyan-600/10 animate-pulse" />
      )}
      
      {/* Particle background effect */}
      {particleEffect && (
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
          <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-3/4 w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '2s' }} />
        </div>
      )}

      <div className="relative z-10 p-6 space-y-6">
        {/* Header Section */}
        <div className="flex items-center gap-6">
          <div className="relative group">
            <img 
              src={currentFile.cover} 
              alt={currentFile.title} 
              className="w-20 h-20 rounded-xl object-cover shadow-2xl ring-2 ring-white/20 transition-all duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-cyan-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {isPlaying && (
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/30 to-cyan-500/30 rounded-xl animate-pulse" />
            )}
          </div>
          
          <div className="flex-1 min-w-0 space-y-2">
            <h2 className="text-2xl font-bold text-white truncate">{currentFile.title}</h2>
            <p className="text-lg text-gray-300 truncate">{currentFile.artist}</p>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-200">
                {currentFile.genre}
              </Badge>
              <span>{currentFile.year}</span>
              <span>{currentFile.bitrate}</span>
              <span>{currentFile.sampleRate}</span>
            </div>
            
            {/* Star Rating */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Button
                  key={star}
                  variant="ghost"
                  size="icon"
                  className="w-5 h-5 p-0 hover:bg-transparent"
                  onClick={() => setRating(star)}
                >
                  <Star 
                    size={14} 
                    className={star <= rating ? "text-yellow-400 fill-current" : "text-gray-500"} 
                  />
                </Button>
              ))}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "hover:bg-white/10 transition-all duration-300",
                isFavorite ? "text-red-400 hover:text-red-300" : "text-gray-400 hover:text-white"
              )}
              onClick={toggleFavorite}
            >
              <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white hover:bg-white/10"
              onClick={() => showToast("Shared to social media!")}
            >
              <Share2 size={20} />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <BookmarkPlus size={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                <DropdownMenuLabel className="text-white">Add to playlist</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-700" />
                {playlists.map(playlist => (
                  <DropdownMenuItem 
                    key={playlist.id}
                    className="text-gray-300 hover:bg-slate-700 hover:text-white"
                  >
                    {playlist.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "text-gray-400 hover:text-white hover:bg-white/10",
                recordingMode && "text-red-400"
              )}
              onClick={() => setRecordingMode(!recordingMode)}
            >
              <Mic size={20} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white hover:bg-white/10"
              onClick={() => showToast("Downloaded to your library")}
            >
              <Download size={20} />
            </Button>
          </div>
        </div>

        {/* Advanced Visualizer */}
        <div className="relative h-24 rounded-xl overflow-hidden bg-black/20 border border-white/10">
          {showSpectrum ? (
            <SpectrumAnalyzer isPlaying={isPlaying} />
          ) : (
            <AdvancedVisualizer 
              isPlaying={isPlaying} 
              mode={visualizerMode} 
              intensity={visualizerIntensity}
            />
          )}
          
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setShowSpectrum(!showSpectrum)}
            >
              <Activity size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setParticleEffect(!particleEffect)}
            >
              <Sparkles size={14} />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 w-12 text-center font-mono">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 relative">
              <Slider
                value={[currentTime]}
                max={duration}
                step={1}
                onValueChange={handleProgressChange}
                className="w-full"
              />
              <div className="absolute -top-8 left-0 right-0 flex justify-between text-xs text-gray-500 pointer-events-none">
                {[0, 0.25, 0.5, 0.75, 1].map((pos, i) => (
                  <span key={i}>{formatTime(duration * pos)}</span>
                ))}
              </div>
            </div>
            <span className="text-sm text-gray-400 w-12 text-center font-mono">
              {formatTime(duration)}
            </span>
          </div>

          {/* Sleep Timer */}
          {sleepTimer > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-purple-300">
              <Timer size={16} />
              <span>Sleep timer: {sleepTimer} minutes</span>
            </div>
          )}
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "text-gray-400 hover:text-white hover:bg-white/10",
                shuffle && "text-purple-400"
              )}
              onClick={() => setShuffle(!shuffle)}
            >
              <Shuffle size={18} />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/10">
                  <Timer size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-800 border-slate-700">
                <DropdownMenuLabel className="text-white">Sleep Timer</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-700" />
                {[0, 15, 30, 45, 60, 90, 120].map(minutes => (
                  <DropdownMenuItem 
                    key={minutes}
                    onClick={() => handleSleepTimer(minutes)}
                    className="text-gray-300 hover:bg-slate-700"
                  >
                    {minutes === 0 ? 'Off' : `${minutes} minutes`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/10"
              onClick={() => setCurrentTime(Math.max(0, currentTime - 10))}
            >
              <Rewind size={20} />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/10"
            >
              <SkipBack size={20} />
            </Button>
            
            <Button 
              size="icon" 
              className="w-14 h-14 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 rounded-full shadow-lg transition-all duration-300 hover:scale-105"
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/10"
            >
              <SkipForward size={20} />
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/10"
              onClick={() => setCurrentTime(Math.min(duration, currentTime + 10))}
            >
              <FastForward size={20} />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "text-gray-400 hover:text-white hover:bg-white/10",
                repeat && "text-purple-400"
              )}
              onClick={() => setRepeat(!repeat)}
            >
              <Repeat size={18} />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/10">
                  <Settings size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-800 border-slate-700">
                <DropdownMenuLabel className="text-white">Audio Settings</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuCheckboxItem 
                  checked={crossfadeEnabled}
                  onCheckedChange={setCrossfadeEnabled}
                  className="text-gray-300"
                >
                  Crossfade
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  checked={surroundSound}
                  onCheckedChange={setSurroundSound}
                  className="text-gray-300"
                >
                  Surround Sound
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  checked={noiseReduction}
                  onCheckedChange={setNoiseReduction}
                  className="text-gray-300"
                >
                  Noise Reduction
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  checked={autoGain}
                  onCheckedChange={setAutoGain}
                  className="text-gray-300"
                >
                  Auto Gain Control
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Advanced Controls Panel */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-gray-400 hover:text-white hover:bg-white/10"
              onClick={handleVolumeClick}
            >
              <VolumeIcon />
            </Button>
            <div className="flex items-center gap-2">
              <Slider
                value={[volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-24"
              />
              <span className="text-xs text-gray-400 w-8">{Math.round(volume * 100)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Speed:</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                    {playbackSpeed}x
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-800 border-slate-700">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                    <DropdownMenuItem 
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className="text-gray-300 hover:bg-slate-700"
                    >
                      {speed}x
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-white/10"
              onClick={() => setShowAdvancedControls(!showAdvancedControls)}
            >
              <SlidersHorizontal size={16} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "text-gray-400 hover:text-white hover:bg-white/10",
                ambientMode && "text-purple-400"
              )}
              onClick={() => setAmbientMode(!ambientMode)}
            >
              <Eye size={18} />
            </Button>
          </div>
        </div>

        {/* Advanced Audio Controls (Expandable) */}
        {showAdvancedControls && (
          <div className="space-y-4 p-4 bg-black/20 rounded-xl border border-white/10">
            <h3 className="text-sm font-semibold text-white mb-3">Advanced Audio Controls</h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Bass Boost</span>
                  <span className="text-xs text-gray-400">{bassBoost > 0 ? '+' : ''}{bassBoost}dB</span>
                </div>
                <Slider
                  value={[bassBoost]}
                  min={-12}
                  max={12}
                  step={1}
                  onValueChange={(value) => setBassBoost(value[0])}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Treble Boost</span>
                  <span className="text-xs text-gray-400">{trebleBoost > 0 ? '+' : ''}{trebleBoost}dB</span>
                </div>
                <Slider
                  value={[trebleBoost]}
                  min={-12}
                  max={12}
                  step={1}
                  onValueChange={(value) => setTrebleBoost(value[0])}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Visualizer Intensity</span>
                  <span className="text-xs text-gray-400">{Math.round(visualizerIntensity * 100)}%</span>
                </div>
                <Slider
                  value={[visualizerIntensity]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={(value) => setVisualizerIntensity(value[0])}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Visualizer Mode</span>
                </div>
                <div className="flex gap-2">
                  {['cosmic', 'fire', 'ocean'].map(mode => (
                    <Button
                      key={mode}
                      variant={visualizerMode === mode ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setVisualizerMode(mode)}
                      className={cn(
                        "capitalize",
                        visualizerMode === mode 
                          ? "bg-purple-600 hover:bg-purple-700" 
                          : "text-gray-400 hover:text-white hover:bg-white/10"
                      )}
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={surroundSound}
                    onCheckedChange={setSurroundSound}
                    className="data-[state=checked]:bg-purple-600"
                  />
                  <span className="text-sm text-gray-300">3D Surround</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={noiseReduction}
                    onCheckedChange={setNoiseReduction}
                    className="data-[state=checked]:bg-purple-600"
                  />
                  <span className="text-sm text-gray-300">Noise Reduction</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300">Mood:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white capitalize">
                      {moodLighting} <Palette size={14} className="ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-slate-800 border-slate-700">
                    {['auto', 'energetic', 'calm', 'focus', 'party'].map(mood => (
                      <DropdownMenuItem 
                        key={mood}
                        onClick={() => setMoodLighting(mood)}
                        className="text-gray-300 hover:bg-slate-700 capitalize"
                      >
                        {mood}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}

        {/* Lyrics Panel (Optional) */}
        {showLyrics && (
          <div className="bg-black/20 rounded-xl border border-white/10 p-4 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Lyrics</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLyrics(false)}
                className="w-6 h-6 text-gray-400 hover:text-white"
              >
                <EyeOff size={14} />
              </Button>
            </div>
            <div className="space-y-2 text-sm text-gray-300 leading-relaxed">
              <p className="opacity-60">Under the starlight, we dance tonight</p>
              <p className="text-purple-300 font-medium">In the cosmic symphony of our hearts</p>
              <p className="opacity-60">Every beat, every note, feels so right</p>
              <p className="opacity-40">As the melody carries us to distant stars...</p>
            </div>
          </div>
        )}

        {/* Quick Actions Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLyrics(!showLyrics)}
              className="text-gray-400 hover:text-white hover:bg-white/10 text-xs"
            >
              <Music size={14} className="mr-1" />
              Lyrics
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-white/10 text-xs"
              onClick={() => showToast("Radio mode activated!")}
            >
              <Radio size={14} className="mr-1" />
              Radio
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-white/10 text-xs"
              onClick={() => showToast("Concert mode enabled!")}
            >
              <Headphones size={14} className="mr-1" />
              Concert
            </Button>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            {crossfadeEnabled && <Badge variant="outline" className="text-xs">Crossfade</Badge>}
            {surroundSound && <Badge variant="outline" className="text-xs">3D Audio</Badge>}
            {noiseReduction && <Badge variant="outline" className="text-xs">Clean</Badge>}
            {recordingMode && <Badge variant="outline" className="text-xs text-red-400 border-red-400">REC</Badge>}
            {sleepTimer > 0 && <Badge variant="outline" className="text-xs text-purple-400 border-purple-400">Sleep</Badge>}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <TrendingUp size={12} />
            <span>Quality: {currentFile.bitrate}</span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Connected" />
          </div>
        </div>

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          preload="metadata"
          className="hidden"
        />

        {/* Floating Action Button for Mobile/Touch */}
        <div className="fixed bottom-4 right-4 md:hidden">
          <Button
            size="icon"
            className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 shadow-lg"
            onClick={togglePlayback}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </Button>
        </div>

        {/* Performance Stats (Debug Mode) */}
        <div className="absolute top-2 left-2 opacity-20 hover:opacity-100 transition-opacity">
          <div className="text-xs text-gray-500 space-y-1">
            <div>CPU: {Math.round(Math.random() * 15 + 5)}%</div>
            <div>Buffer: {Math.round(Math.random() * 30 + 70)}%</div>
            <div>Latency: {Math.round(Math.random() * 10 + 5)}ms</div>
          </div>
        </div>

        {/* Ambient Glow Effect */}
        {ambientMode && isPlaying && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5 animate-pulse" />
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                background: `radial-gradient(circle at ${Math.sin(Date.now() * 0.001) * 50 + 50}% ${Math.cos(Date.now() * 0.001) * 50 + 50}%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)`,
                animation: 'pulse 4s ease-in-out infinite'
              }}
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export default AudioPlayer;