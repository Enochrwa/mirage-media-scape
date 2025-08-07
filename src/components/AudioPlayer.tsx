import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX, 
  Repeat, Shuffle, Heart, Share2, BookmarkPlus, MoreHorizontal, 
  Globe, Mic, Radio, Headphones, Settings, Zap, Music, Waves,
  Timer, Clock, Rewind, FastForward, Download, Upload, Star,
  TrendingUp, Activity, Sparkles, Eye, EyeOff, RotateCcw,
  Wind, Sun, Moon, Palette, Filter, SlidersHorizontal, Maximize, Minimize
} from 'lucide-react';

// Simplified UI Components (since we don't have access to the full shadcn/ui library)
const Button = ({ children, variant = "default", size = "default", className = "", onClick, ...props }) => (
  <button 
    onClick={onClick}
    className={cn(
      "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
      variant === "ghost" ? "hover:bg-accent hover:text-accent-foreground" :
      variant === "outline" ? "border border-input hover:bg-accent hover:text-accent-foreground" :
      "bg-primary text-primary-foreground hover:bg-primary/90",
      size === "sm" ? "h-9 px-3 rounded-md text-xs" :
      size === "icon" ? "h-10 w-10" :
      "h-10 px-4 py-2",
      className
    )}
    {...props}
  >
    {children}
  </button>
);

const Card = ({ children, className = "" }) => (
  <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default", className = "" }) => (
  <div className={cn(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    variant === "secondary" ? "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80" :
    variant === "outline" ? "text-foreground" :
    "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    className
  )}>
    {children}
  </div>
);

const Slider = ({ value, max, min = 0, step = 1, onValueChange, className = "" }) => {
  const handleChange = (e) => {
    const newValue = parseFloat(e.target.value);
    onValueChange([newValue]);
  };

  return (
    <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={handleChange}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
        style={{
          background: `linear-gradient(to right, rgb(139, 92, 246) 0%, rgb(139, 92, 246) ${(value[0] / max) * 100}%, rgb(55, 65, 81) ${(value[0] / max) * 100}%, rgb(55, 65, 81) 100%)`
        }}
      />
      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgb(139, 92, 246);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .slider-thumb::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgb(139, 92, 246);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
};

const Switch = ({ checked, onCheckedChange, className = "" }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-purple-600" : "bg-gray-600",
      className
    )}
  >
    <span
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
        checked ? "translate-x-5" : "translate-x-0"
      )}
    />
  </button>
);

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

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Advanced Audio Visualizer Component
const AdvancedVisualizer = ({ isPlaying, mode, intensity }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef();
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
      width={800}
      height={120}
      className="w-full h-full rounded-lg"
      style={{ background: 'rgba(0,0,0,0.1)' }}
    />
  );
};

// Spectrum Analyzer Component
const SpectrumAnalyzer = ({ isPlaying }) => {
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
            width: '6px',
            height: isPlaying ? `${Math.max(4, height)}%` : '4px',
          }}
        />
      ))}
    </div>
  );
};

import { useMedia, MediaFile } from '@/contexts/MediaContext';

interface AudioPlayerProps {
  file?: MediaFile;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ file }) => {
  const media = useMedia();
  // Core player state
  const [currentFile] = useState(file || mockCurrentFile);
  const [playlists] = useState(media.playlists || mockPlaylists);
  const [isPlaying, setIsPlaying] = useState(media.isPlaying || false);
  const [volume, setVolume] = useState(media.volume || 0.7);
  const [currentTime, setCurrentTime] = useState(media.currentTime || 67);
  const [duration] = useState(media.duration || 245);
  const [muted, setMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  const [isPlayerFullscreen, setPlayerFullscreen] = useState(false);
  
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
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showMoodMenu, setShowMoodMenu] = useState(false);
  
  // Refs
  const audioRef = useRef(null);

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

  const handleVolumeChange = (newVolume) => {
    const vol = newVolume[0];
    setVolume(vol);
    if (vol > 0 && muted) {
      setMuted(false);
    } else if (vol === 0) {
      setMuted(true);
    }
  };

  const VolumeIcon = () => {
    if (muted || volume === 0) return <VolumeX size={20} />;
    if (volume < 0.5) return <Volume1 size={20} />;
    return <Volume2 size={20} />;
  };

  const handleProgressChange = (newValue) => {
    setCurrentTime(newValue[0]);
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  };

  const handleSleepTimer = (minutes) => {
    setSleepTimer(minutes);
    setShowTimerMenu(false);
    if (minutes > 0) {
      setTimeout(() => {
        setIsPlaying(false);
        setSleepTimer(0);
      }, minutes * 60 * 1000);
    }
  };

  const showToast = (message) => {
    // Mock toast notification
    console.log('Toast:', message);
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    showToast(isFavorite ? "Removed from favorites" : "Added to favorites");
  };

  if (isPlayerFullscreen) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center justify-between p-8 text-white">
        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-white/10"
            onClick={() => {
              const link = document.createElement('a');
              link.href = currentFile.file;
              link.download = `${currentFile.title}.mp3`;
              link.click();
            }}
          >
            <Download size={22} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-white/10"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              showToast("Link copied to clipboard!");
            }}
          >
            <Share2 size={22} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-white/10"
            onClick={() => setPlayerFullscreen(false)}
          >
            <Minimize size={22} />
          </Button>
        </div>

        <div className="flex flex-col items-center gap-6 text-center">
          <img 
            src={currentFile.cover} 
            alt={currentFile.title} 
            className="w-64 h-64 rounded-full shadow-2xl animate-pulse-slow" 
          />
          <h1 className="text-5xl font-bold">{currentFile.title}</h1>
          <p className="text-2xl text-gray-400">{currentFile.artist}</p>
        </div>

        <div className="w-full max-w-5xl h-48 my-8">
          <AdvancedVisualizer isPlaying={isPlaying} mode={visualizerMode} intensity={visualizerIntensity} />
        </div>

        <div className="w-full max-w-3xl space-y-6">
          <div className="flex items-center gap-4">
            <span className="text-base text-gray-400 w-16 text-center font-mono">
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
            </div>
            <span className="text-base text-gray-400 w-16 text-center font-mono">
              {formatTime(duration)}
            </span>
          </div>
          <div className="flex items-center justify-center gap-6">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 w-12 h-12">
              <SkipBack size={28} />
            </Button>
            <Button
              size="icon"
              className="w-24 h-24 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 rounded-full shadow-2xl transition-all duration-300 hover:scale-105"
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause size={36} /> : <Play size={36} className="ml-1" />}
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 w-12 h-12">
              <SkipForward size={28} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-cyan-900/20 p-4 flex items-center justify-center">
      <Card className={cn(
        "relative overflow-hidden w-[80vw] max-w-none",
        "bg-gradient-to-br from-slate-900/95 via-purple-900/30 to-cyan-900/30",
        "backdrop-blur-xl border border-white/20 shadow-2xl",
        ambientMode && "ring-2 ring-purple-500/50 shadow-purple-500/25"
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

        <div className="relative z-10 p-8 space-y-8">
          {/* Header Section */}
          <div className="flex items-start gap-8">
            <div className="relative group">
              <img 
                src={currentFile.cover} 
                alt={currentFile.title} 
                className="w-32 h-32 rounded-2xl object-cover shadow-2xl ring-2 ring-white/20 transition-all duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-cyan-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              {isPlaying && (
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/30 to-cyan-500/30 rounded-2xl animate-pulse" />
              )}
            </div>
            
            <div className="flex-1 min-w-0 space-y-4">
              <h2 className="text-4xl font-bold text-white truncate">{currentFile.title}</h2>
              <p className="text-2xl text-gray-300 truncate">{currentFile.artist}</p>
              <div className="flex items-center gap-6 text-base text-gray-400">
                <Badge variant="secondary" className="bg-purple-500/20 text-purple-200 text-base px-4 py-1">
                  {currentFile.genre}
                </Badge>
                <span>{currentFile.year}</span>
                <span>{currentFile.bitrate}</span>
                <span>{currentFile.sampleRate}</span>
              </div>
              
              {/* Star Rating */}
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 p-0 hover:bg-transparent"
                    onClick={() => setRating(star)}
                  >
                    <Star 
                      size={18} 
                      className={star <= rating ? "text-yellow-400 fill-current" : "text-gray-500"} 
                    />
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "hover:bg-white/10 transition-all duration-300 w-12 h-12",
                  isFavorite ? "text-red-400 hover:text-red-300" : "text-gray-400 hover:text-white"
                )}
                onClick={toggleFavorite}
              >
                <Heart size={24} fill={isFavorite ? "currentColor" : "none"} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white hover:bg-white/10 w-12 h-12"
                onClick={() => {
                  navigator.clipboard.writeText(`${currentFile.title} by ${currentFile.artist}`);
                  showToast("Copied to clipboard!");
                }}
              >
                <Share2 size={24} />
              </Button>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-white hover:bg-white/10 w-12 h-12"
                  onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
                >
                  <BookmarkPlus size={24} />
                </Button>
                {showPlaylistMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg p-2 min-w-48 z-20">
                    <div className="text-white text-sm font-semibold p-2">Add to playlist</div>
                    <div className="border-t border-slate-700 my-1"></div>
                    {playlists.map(playlist => (
                      <button 
                        key={playlist.id}
                        className="block w-full text-left text-gray-300 hover:bg-slate-700 hover:text-white p-2 rounded text-sm"
                        onClick={() => {
                          setShowPlaylistMenu(false);
                          showToast(`Added to ${playlist.name}`);
                        }}
                      >
                        {playlist.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-gray-400 hover:text-white hover:bg-white/10 w-12 h-12",
                  recordingMode && "text-red-400"
                )}
                onClick={() => setRecordingMode(!recordingMode)}
              >
                <Mic size={24} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white hover:bg-white/10 w-12 h-12"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = currentFile.file;
                  link.download = `${currentFile.title}.mp3`;
                  link.click();
                }}
              >
                <Download size={24} />
              </Button>
            </div>
          </div>

          {/* Advanced Visualizer */}
          <div className="relative h-32 rounded-2xl overflow-hidden bg-black/20 border border-white/10">
            {showSpectrum ? (
              <div className="h-full flex items-center justify-center">
                <SpectrumAnalyzer isPlaying={isPlaying} />
              </div>
            ) : (
              <AdvancedVisualizer 
                isPlaying={isPlaying} 
                mode={visualizerMode} 
                intensity={visualizerIntensity}
              />
            )}
            
            <div className="absolute top-3 right-3 flex gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setShowSpectrum(!showSpectrum)}
              >
                <Activity size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setParticleEffect(!particleEffect)}
              >
                <Sparkles size={18} />
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-base text-gray-400 w-16 text-center font-mono">
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
              <span className="text-base text-gray-400 w-16 text-center font-mono">
                {formatTime(duration)}
              </span>
            </div>

            {/* Sleep Timer */}
            {sleepTimer > 0 && (
              <div className="flex items-center justify-center gap-3 text-base text-purple-300">
                <Timer size={20} />
                <span>Sleep timer: {sleepTimer} minutes</span>
              </div>
            )}
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "text-gray-400 hover:text-white hover:bg-white/10 w-12 h-12",
                  shuffle && "text-purple-400"
                )}
                onClick={() => setShuffle(!shuffle)}
              >
                <Shuffle size={22} />
              </Button>

              <div className="relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-gray-400 hover:text-white hover:bg-white/10 w-12 h-12"
                  onClick={() => setShowTimerMenu(!showTimerMenu)}
                >
                  <Timer size={22} />
                </Button>
                {showTimerMenu && (
                  <div className="absolute bottom-full left-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg p-2 min-w-32 z-20">
                    <div className="text-white text-sm font-semibold p-2">Sleep Timer</div>
                    <div className="border-t border-slate-700 my-1"></div>
                    {[0, 15, 30, 45, 60, 90, 120].map(minutes => (
                      <button 
                        key={minutes}
                        onClick={() => handleSleepTimer(minutes)}
                        className="block w-full text-left text-gray-300 hover:bg-slate-700 hover:text-white p-2 rounded text-sm"
                      >
                        {minutes === 0 ? 'Off' : `${minutes} min`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/10 w-12 h-12"
                onClick={() => setCurrentTime(Math.max(0, currentTime - 10))}
              >
                <Rewind size={24} />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/10 w-12 h-12"
              >
                <SkipBack size={24} />
              </Button>
              
              <Button 
                size="icon" 
                className="w-16 h-16 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 rounded-full shadow-lg transition-all duration-300 hover:scale-105"
                onClick={togglePlayback}
              >
                {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/10 w-12 h-12"
              >
                <SkipForward size={24} />
              </Button>

              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/10 w-12 h-12"
                onClick={() => setCurrentTime(Math.min(duration, currentTime + 10))}
              >
                <FastForward size={24} />
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "text-gray-400 hover:text-white hover:bg-white/10 w-12 h-12",
                  repeat && "text-purple-400"
                )}
                onClick={() => setRepeat(!repeat)}
              >
                <Repeat size={22} />
              </Button>

              <div className="relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-gray-400 hover:text-white hover:bg-white/10 w-12 h-12"
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                >
                  <Settings size={22} />
                </Button>
                {showSettingsMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg p-3 min-w-48 z-20">
                    <div className="text-white text-sm font-semibold mb-3">Audio Settings</div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 text-sm">Crossfade</span>
                        <Switch
                          checked={crossfadeEnabled}
                          onCheckedChange={setCrossfadeEnabled}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 text-sm">Surround Sound</span>
                        <Switch
                          checked={surroundSound}
                          onCheckedChange={setSurroundSound}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 text-sm">Noise Reduction</span>
                        <Switch
                          checked={noiseReduction}
                          onCheckedChange={setNoiseReduction}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 text-sm">Auto Gain</span>
                        <Switch
                          checked={autoGain}
                          onCheckedChange={setAutoGain}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Advanced Controls Panel */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-gray-400 hover:text-white hover:bg-white/10 w-12 h-12"
                onClick={handleVolumeClick}
              >
                <VolumeIcon />
              </Button>
              <div className="flex items-center gap-3">
                <Slider
                  value={[volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="w-32"
                />
                <span className="text-sm text-gray-400 w-10 text-center">{Math.round(volume * 100)}%</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">Speed:</span>
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-gray-400 hover:text-white"
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  >
                    {playbackSpeed}x
                  </Button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg p-2 min-w-20 z-20">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                        <button 
                          key={speed}
                          onClick={() => handleSpeedChange(speed)}
                          className="block w-full text-left text-gray-300 hover:bg-slate-700 hover:text-white p-2 rounded text-sm"
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white hover:bg-white/10"
                onClick={() => setShowAdvancedControls(!showAdvancedControls)}
              >
                <SlidersHorizontal size={20} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-gray-400 hover:text-white hover:bg-white/10 w-12 h-12",
                  ambientMode && "text-purple-400"
                )}
                onClick={() => setAmbientMode(!ambientMode)}
              >
                <Eye size={22} />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white hover:bg-white/10 w-12 h-12"
                onClick={() => setPlayerFullscreen(true)}
              >
                <Maximize size={22} />
              </Button>
            </div>
          </div>

          {/* Advanced Audio Controls (Expandable) */}
          {showAdvancedControls && (
            <div className="space-y-6 p-6 bg-black/20 rounded-2xl border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Advanced Audio Controls</h3>
              
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base text-gray-300">Bass Boost</span>
                    <span className="text-sm text-gray-400">{bassBoost > 0 ? '+' : ''}{bassBoost}dB</span>
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

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base text-gray-300">Treble Boost</span>
                    <span className="text-sm text-gray-400">{trebleBoost > 0 ? '+' : ''}{trebleBoost}dB</span>
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

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base text-gray-300">Visualizer Intensity</span>
                    <span className="text-sm text-gray-400">{Math.round(visualizerIntensity * 100)}%</span>
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

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base text-gray-300">Visualizer Mode</span>
                  </div>
                  <div className="flex gap-3">
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

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={surroundSound}
                      onCheckedChange={setSurroundSound}
                      className="data-[state=checked]:bg-purple-600"
                    />
                    <span className="text-base text-gray-300">3D Surround</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={noiseReduction}
                      onCheckedChange={setNoiseReduction}
                      className="data-[state=checked]:bg-purple-600"
                    />
                    <span className="text-base text-gray-300">Noise Reduction</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-base text-gray-300">Mood:</span>
                  <div className="relative">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-400 hover:text-white capitalize"
                      onClick={() => setShowMoodMenu(!showMoodMenu)}
                    >
                      {moodLighting} <Palette size={18} className="ml-2" />
                    </Button>
                    {showMoodMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg p-2 min-w-24 z-20">
                        {['auto', 'energetic', 'calm', 'focus', 'party'].map(mood => (
                          <button 
                            key={mood}
                            onClick={() => {
                              setMoodLighting(mood);
                              setShowMoodMenu(false);
                            }}
                            className="block w-full text-left text-gray-300 hover:bg-slate-700 hover:text-white p-2 rounded text-sm capitalize"
                          >
                            {mood}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lyrics Panel (Optional) */}
          {showLyrics && (
            <div className="bg-black/20 rounded-2xl border border-white/10 p-6 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Lyrics</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowLyrics(false)}
                  className="w-8 h-8 text-gray-400 hover:text-white"
                >
                  <EyeOff size={18} />
                </Button>
              </div>
              <div className="space-y-3 text-base text-gray-300 leading-relaxed">
                <p className="opacity-60">Under the starlight, we dance tonight</p>
                <p className="text-purple-300 font-medium">In the cosmic symphony of our hearts</p>
                <p className="opacity-60">Every beat, every note, feels so right</p>
                <p className="opacity-40">As the melody carries us to distant stars...</p>
              </div>
            </div>
          )}

          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLyrics(!showLyrics)}
                className="text-gray-400 hover:text-white hover:bg-white/10 text-sm"
              >
                <Music size={18} className="mr-2" />
                Lyrics
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white hover:bg-white/10 text-sm"
                onClick={() => showToast("Radio mode activated!")}
              >
                <Radio size={18} className="mr-2" />
                Radio
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white hover:bg-white/10 text-sm"
                onClick={() => showToast("Concert mode enabled!")}
              >
                <Headphones size={18} className="mr-2" />
                Concert
              </Button>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-400">
              {crossfadeEnabled && <Badge variant="outline" className="text-sm">Crossfade</Badge>}
              {surroundSound && <Badge variant="outline" className="text-sm">3D Audio</Badge>}
              {noiseReduction && <Badge variant="outline" className="text-sm">Clean</Badge>}
              {recordingMode && <Badge variant="outline" className="text-sm text-red-400 border-red-400">REC</Badge>}
              {sleepTimer > 0 && <Badge variant="outline" className="text-sm text-purple-400 border-purple-400">Sleep</Badge>}
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-400">
              <TrendingUp size={16} />
              <span>Quality: {currentFile.bitrate}</span>
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" title="Connected" />
            </div>
          </div>

          {/* Hidden Audio Element */}
          <audio
            ref={audioRef}
            preload="metadata"
            className="hidden"
          />

          {/* Performance Stats (Debug Mode) */}
          <div className="absolute top-4 left-4 opacity-20 hover:opacity-100 transition-opacity">
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
    </div>
  );
};

export default AudioPlayer;