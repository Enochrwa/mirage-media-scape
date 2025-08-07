import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX, 
  Maximize, Minimize, Heart, Share2, BookmarkPlus, Globe, MoreHorizontal,
  Settings, Zap, Eye, Palette, Rewind, FastForward, RotateCcw, RotateCw,
  Monitor, Smartphone, Tablet, PictureInPicture, Download, Subtitles,
  Filter, Sparkles, Wind, Waves, Sun, Moon, Star, Camera, Mic, X
} from 'lucide-react';

// Mock data for demo
const mockFile = {
  id: '1',
  title: 'Epic Cinematic Journey',
  artist: 'Visionary Studios',
  file: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  type: 'video' as const,
  duration: 596.5
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Particle system for visual effects
const ParticleSystem = ({ isActive, theme }: { isActive: boolean, theme: string }) => {
  const [particles, setParticles] = useState<Array<{ id: number, x: number, y: number, size: number, opacity: number, vx: number, vy: number }>>([]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setParticles(prev => {
        const newParticles = prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            opacity: p.opacity - 0.02
          }))
          .filter(p => p.opacity > 0);

        // Add new particles
        if (Math.random() > 0.7) {
          newParticles.push({
            id: Math.random(),
            x: Math.random() * window.innerWidth,
            y: window.innerHeight,
            size: Math.random() * 4 + 2,
            opacity: 1,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 3 - 1
          });
        }

        return newParticles.slice(-30); // Limit particles
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(particle => (
        <div
          key={particle.id}
          className={cn(
            "absolute rounded-full",
            theme === 'fire' ? 'bg-orange-400' :
            theme === 'water' ? 'bg-blue-400' :
            theme === 'electric' ? 'bg-yellow-400' :
            'bg-purple-400'
          )}
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            opacity: particle.opacity,
            boxShadow: `0 0 ${particle.size * 2}px currentColor`
          }}
        />
      ))}
    </div>
  );
};

const VideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State management
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(596.5);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [mouseMovementTimeout, setMouseMovementTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [visualizerActive, setVisualizerActive] = useState(false);
  const [particleTheme, setParticleTheme] = useState('electric');
  const [aiEnhancement, setAiEnhancement] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [ambientLighting, setAmbientLighting] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [gestureControl, setGestureControl] = useState(false);
  const [smartRewind, setSmartRewind] = useState(false);
  const [qualityMode, setQualityMode] = useState('auto');
  const [devicePreview, setDevicePreview] = useState('desktop');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Audio visualizer setup
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !visualizerActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaElementSource(video);
    
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!visualizerActive) return;
      
      requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = canvas.width / bufferLength * 2.5;
      let barHeight;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        
        const red = barHeight + 25 * (i / bufferLength);
        const green = 250 * (i / bufferLength);
        const blue = 50;
        
        ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.8)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }
    };
    
    draw();
    
    return () => {
      audioContext.close();
    };
  }, [visualizerActive]);

  // Enhanced gesture controls
  useEffect(() => {
    if (!gestureControl || !videoContainerRef.current) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = currentTime;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - startX;
        const deltaY = e.touches[0].clientY - startY;
        
        // Horizontal swipe for seeking
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
          const seekDelta = (deltaX / window.innerWidth) * 60; // 60 seconds max
          const newTime = Math.max(0, Math.min(duration, startTime + seekDelta));
          setCurrentTime(newTime);
          if (videoRef.current) {
            videoRef.current.currentTime = newTime;
          }
        }
        
        // Vertical swipe for volume
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
          const volumeDelta = -(deltaY / window.innerHeight);
          const newVolume = Math.max(0, Math.min(1, volume + volumeDelta));
          setVolume(newVolume);
        }
      }
    };

    const container = videoContainerRef.current;
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [gestureControl, volume, currentTime, duration]);

  // Smart rewind feature
  const handleSmartRewind = useCallback(() => {
    if (!smartRewind || !videoRef.current) return;
    
    // Rewind to last significant moment (simulate scene detection)
    const smartPositions = [0, 30, 65, 120, 180, 240, 300, 360, 420, 480];
    const currentPos = Math.floor(currentTime);
    const previousScene = smartPositions.reverse().find(pos => pos < currentPos) || 0;
    
    setCurrentTime(previousScene);
    videoRef.current.currentTime = previousScene;
  }, [smartRewind, currentTime]);

  // Ambient lighting effect
  useEffect(() => {
    if (!ambientLighting || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    const updateAmbient = () => {
      if (!ambientLighting) return;
      
      canvas.width = 1;
      canvas.height = 1;
      ctx.drawImage(video, 0, 0, 1, 1);
      
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      const avgColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
      
      if (videoContainerRef.current) {
        videoContainerRef.current.style.boxShadow = `0 0 50px ${avgColor}`;
      }
      
      requestAnimationFrame(updateAmbient);
    };
    
    updateAmbient();
  }, [ambientLighting]);

  const togglePlayback = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
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
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
    if (vol > 0 && muted) {
      setMuted(false);
    } else if (vol === 0) {
      setMuted(true);
    }
  };

  const handleProgressChange = (newValue: number[]) => {
    const time = newValue[0];
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const toggleFullscreen = async () => {
    if (!videoContainerRef.current) return;
    
    try {
      if (!isFullscreen) {
        await videoContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    
    try {
      if (isPiP) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
      setIsPiP(!isPiP);
    } catch (error) {
      console.error('PiP error:', error);
    }
  };

  const handleMouseMove = () => {
    setControlsVisible(true);
    
    if (mouseMovementTimeout) {
      clearTimeout(mouseMovementTimeout);
    }
    
    if (isPlaying && !showSettings) {
      const timeout = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
      
      setMouseMovementTimeout(timeout);
    }
  };

  const VolumeIcon = () => {
    if (muted || volume === 0) return <VolumeX size={isMobile ? 16 : 18} />;
    if (volume < 0.5) return <Volume1 size={isMobile ? 16 : 18} />;
    return <Volume2 size={isMobile ? 16 : 18} />;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-2 sm:p-4">
      <div className="w-full max-w-[95vw] mx-auto h-[95vh] flex flex-col">
        {/* Main Video Container */}
        <div 
          className={cn(
            "relative overflow-hidden rounded-xl sm:rounded-2xl transition-all duration-500 flex-1",
            immersiveMode && "rounded-none",
            ambientLighting && "transition-shadow duration-300",
            "bg-black shadow-2xl",
            // Device preview styles
            devicePreview === 'mobile' ? "max-w-sm mx-auto aspect-[9/16]" :
            devicePreview === 'tablet' ? "max-w-4xl mx-auto aspect-[4/3]" :
            "w-full h-full"
          )}
          ref={videoContainerRef}
          onMouseMove={handleMouseMove}
          style={{
            filter: aiEnhancement ? 'contrast(1.2) saturate(1.3) brightness(1.1)' : 'none'
          }}
        >
          {/* Particle System */}
          <ParticleSystem isActive={visualizerActive} theme={particleTheme} />
          
          {/* Audio Visualizer Canvas */}
          <canvas
            ref={canvasRef}
            className={cn(
              "absolute inset-0 pointer-events-none mix-blend-screen transition-opacity",
              visualizerActive ? "opacity-60" : "opacity-0"
            )}
            width={800}
            height={400}
          />
          
          {/* Main Video */}
          <video
            ref={videoRef}
            className={cn(
              "w-full h-full object-cover cursor-pointer transition-all duration-300",
              immersiveMode && "object-fill"
            )}
            src={mockFile.file}
            onClick={togglePlayback}
            playsInline
            style={{
              filter: `brightness(${aiEnhancement ? 1.1 : 1}) contrast(${aiEnhancement ? 1.2 : 1}) saturate(${aiEnhancement ? 1.3 : 1})`
            }}
          />
          
          {/* Top Controls Overlay */}
          <div className={cn(
            "absolute top-0 left-0 right-0 bg-gradient-to-b from-black/90 via-black/60 to-transparent p-3 sm:p-6 transition-all duration-300",
            controlsVisible || showSettings ? "opacity-100" : "opacity-0"
          )}>
            <div className="flex items-start justify-between">
              <div className="text-white space-y-1 flex-1 min-w-0">
                <h3 className="font-bold text-sm sm:text-xl truncate">{mockFile.title}</h3>
                <p className="text-xs sm:text-sm opacity-80 truncate">{mockFile.artist}</p>
                <div className="flex items-center gap-2 sm:gap-4 text-xs opacity-70">
                  <span>Quality: {qualityMode.toUpperCase()}</span>
                  <span>Rate: {playbackRate}x</span>
                  {aiEnhancement && <span className="text-blue-400">AI Enhanced</span>}
                </div>
              </div>
              
              <div className="flex gap-1 sm:gap-2 flex-shrink-0 ml-2">
                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={cn(
                    "p-1.5 sm:p-2 rounded-full backdrop-blur-sm transition-all hover:scale-110",
                    isFavorite ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  <Heart size={isMobile ? 16 : 20} fill={isFavorite ? "currentColor" : "none"} />
                </button>
                
                <button
                  onClick={() => navigator.clipboard.writeText(mockFile.title)}
                  className="p-1.5 sm:p-2 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm transition-all hover:scale-110"
                >
                  <Share2 size={isMobile ? 16 : 20} />
                </button>
                
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(
                    "p-1.5 sm:p-2 rounded-full backdrop-blur-sm transition-all hover:scale-110",
                    showSettings ? "bg-blue-500/20 text-blue-400" : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  <Settings size={isMobile ? 16 : 20} />
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Settings Panel */}
          {showSettings && (
            <div className="absolute top-16 sm:top-20 right-2 sm:right-4 bg-black/95 backdrop-blur-md rounded-xl p-3 sm:p-4 text-white w-72 sm:w-80 z-50 max-h-80 overflow-y-auto">
              <h4 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                <Sparkles size={16} />
                Advanced Controls
              </h4>
              
              <div className="space-y-3 sm:space-y-4">
                {/* Feature Toggles */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'aiEnhancement', label: 'AI Enhance', icon: Zap, active: aiEnhancement, setter: setAiEnhancement, color: 'blue' },
                    { key: 'visualizer', label: 'Visualizer', icon: Eye, active: visualizerActive, setter: setVisualizerActive, color: 'purple' },
                    { key: 'ambient', label: 'Ambient', icon: Sun, active: ambientLighting, setter: setAmbientLighting, color: 'orange' },
                    { key: 'gesture', label: 'Gesture', icon: Wind, active: gestureControl, setter: setGestureControl, color: 'green' }
                  ].map(({ key, label, icon: Icon, active, setter, color }) => (
                    <button
                      key={key}
                      onClick={() => setter(!active)}
                      className={cn(
                        "p-2 sm:p-3 rounded-lg transition-all hover:scale-105 flex items-center gap-2 text-sm",
                        active 
                          ? `bg-${color}-500/20 text-${color}-400 border border-${color}-400/30` 
                          : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
                      )}
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                
                {/* Device Preview */}
                <div className="space-y-2">
                  <span className="text-sm flex items-center gap-2">
                    <Monitor size={14} className="text-orange-400 flex-shrink-0" />
                    Device Preview
                  </span>
                  <div className="flex gap-2">
                    {[
                      { key: 'desktop', icon: Monitor, label: 'Desktop' },
                      { key: 'tablet', icon: Tablet, label: 'Tablet' },
                      { key: 'mobile', icon: Smartphone, label: 'Mobile' }
                    ].map(({ key, icon: Icon, label }) => (
                      <button
                        key={key}
                        onClick={() => setDevicePreview(key)}
                        className={cn(
                          "p-2 rounded-lg transition-all flex-1 flex flex-col items-center gap-1",
                          devicePreview === key ? "bg-white/20 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}
                        title={`${label} View`}
                      >
                        <Icon size={14} />
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Particle Theme */}
                <div className="space-y-2">
                  <span className="text-sm flex items-center gap-2">
                    <Palette size={14} className="text-green-400 flex-shrink-0" />
                    Particle Theme
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {['electric', 'fire', 'water', 'cosmic'].map(theme => (
                      <button
                        key={theme}
                        onClick={() => setParticleTheme(theme)}
                        className={cn(
                          "px-3 py-2 rounded-lg text-xs capitalize transition-all",
                          particleTheme === theme ? "bg-white/20 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Controls */}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 sm:p-6 transition-all duration-300",
            controlsVisible || showSettings ? "opacity-100" : "opacity-0"
          )}>
            <div className="space-y-3 sm:space-y-4">
              {/* Progress Bar */}
              <div className="flex items-center gap-2 sm:gap-3 text-white">
                <span className="text-xs font-mono w-10 sm:w-12 text-right">
                  {formatTime(currentTime)}
                </span>
                <div className="flex-1 relative group">
                  <input
                    type="range"
                    min="0"
                    max={duration}
                    value={currentTime}
                    onChange={(e) => handleProgressChange([parseFloat(e.target.value)])}
                    className="w-full h-1 sm:h-2 bg-white/20 rounded-full appearance-none cursor-pointer 
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                      sm:[&::-webkit-slider-thumb]:w-4 sm:[&::-webkit-slider-thumb]:h-4 
                      [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full 
                      [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg
                      [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125
                      group-hover:[&::-webkit-slider-thumb]:scale-125"
                    style={{
                      background: `linear-gradient(to right, #ffffff ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%)`
                    }}
                  />
                </div>
                <span className="text-xs font-mono w-10 sm:w-12">
                  {formatTime(duration)}
                </span>
              </div>
              
              {/* Main Controls */}
              <div className="flex items-center justify-between">
                {/* Left Controls */}
                <div className="flex items-center gap-1 sm:gap-3">
                  {!isMobile && (
                    <>
                      <button
                        onClick={handleSmartRewind}
                        className="p-1.5 sm:p-2 text-white hover:bg-white/10 rounded-full transition-all hover:scale-110"
                        title="Smart Rewind"
                      >
                        <RotateCcw size={16} />
                      </button>
                      
                      <button className="p-1.5 sm:p-2 text-white hover:bg-white/10 rounded-full transition-all hover:scale-110">
                        <SkipBack size={16} />
                      </button>
                    </>
                  )}
                  
                  {/* Enhanced Play Button */}
                  <button 
                    onClick={togglePlayback}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-white text-black hover:bg-white/90 rounded-full flex items-center justify-center transition-all hover:scale-105 shadow-lg"
                  >
                    {isPlaying ? <Pause size={isMobile ? 18 : 20} /> : <Play size={isMobile ? 18 : 20} className="ml-0.5" />}
                  </button>
                  
                  {!isMobile && (
                    <>
                      <button className="p-1.5 sm:p-2 text-white hover:bg-white/10 rounded-full transition-all hover:scale-110">
                        <SkipForward size={16} />
                      </button>
                      
                      {/* Playback Speed */}
                      <div className="relative group">
                        <button className="p-1.5 sm:p-2 text-white hover:bg-white/10 rounded-full transition-all hover:scale-110 flex items-center gap-1">
                          <FastForward size={14} />
                          <span className="text-xs">{playbackRate}x</span>
                        </button>
                        <div className="absolute bottom-full mb-2 left-0 bg-black/90 rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex flex-col gap-1">
                            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                              <button
                                key={rate}
                                onClick={() => {
                                  setPlaybackRate(rate);
                                  if (videoRef.current) videoRef.current.playbackRate = rate;
                                }}
                                className={cn(
                                  "px-3 py-1 text-xs rounded transition-colors whitespace-nowrap",
                                  playbackRate === rate ? "bg-white/20 text-white" : "text-white/70 hover:text-white"
                                )}
                              >
                                {rate}x
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Right Controls */}
                <div className="flex items-center gap-1 sm:gap-3">
                  {/* Volume Controls */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleVolumeClick}
                      className="p-1.5 sm:p-2 text-white hover:bg-white/10 rounded-full transition-all hover:scale-110"
                    >
                      <VolumeIcon />
                    </button>
                    {!isMobile && (
                      <>
                        <div className="w-16 sm:w-24 relative group">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => handleVolumeChange([parseFloat(e.target.value)])}
                            className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer
                              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 
                              sm:[&::-webkit-slider-thumb]:w-3 sm:[&::-webkit-slider-thumb]:h-3 
                              [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full 
                              [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform 
                              [&::-webkit-slider-thumb]:hover:scale-125"
                            style={{
                              background: `linear-gradient(to right, #ffffff ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`
                            }}
                          />
                        </div>
                        <span className="text-xs text-white/70 w-6 sm:w-8 text-center">
                          {Math.round(volume * 100)}
                        </span>
                      </>
                    )}
                  </div>
                  
                  {/* Additional Controls */}
                  {!isMobile && (
                    <>
                      {/* Subtitles */}
                      <button
                        onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-full transition-all hover:scale-110",
                          subtitlesEnabled ? "bg-yellow-500/20 text-yellow-400" : "text-white hover:bg-white/10"
                        )}
                        title="Toggle Subtitles"
                      >
                        <Subtitles size={16} />
                      </button>
                      
                      {/* Picture in Picture */}
                      <button
                        onClick={togglePiP}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-full transition-all hover:scale-110",
                          isPiP ? "bg-blue-500/20 text-blue-400" : "text-white hover:bg-white/10"
                        )}
                        title="Picture in Picture"
                      >
                        <PictureInPicture size={16} />
                      </button>
                      
                      {/* Quality Selector */}
                      <div className="relative group">
                        <button className="p-1.5 sm:p-2 text-white hover:bg-white/10 rounded-full transition-all hover:scale-110 flex items-center gap-1">
                          <Filter size={14} />
                          <span className="text-xs uppercase">{qualityMode}</span>
                        </button>
                        <div className="absolute bottom-full mb-2 right-0 bg-black/90 rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex flex-col gap-1">
                            {['auto', '4k', '1080p', '720p', '480p'].map(quality => (
                              <button
                                key={quality}
                                onClick={() => setQualityMode(quality)}
                                className={cn(
                                  "px-3 py-1 text-xs rounded transition-colors whitespace-nowrap text-left",
                                  qualityMode === quality ? "bg-white/20 text-white" : "text-white/70 hover:text-white"
                                )}
                              >
                                {quality.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Download */}
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = mockFile.file;
                          link.download = `${mockFile.title}.mp4`;
                          link.click();
                        }}
                        className="p-1.5 sm:p-2 text-white hover:bg-white/10 rounded-full transition-all hover:scale-110"
                        title="Download Video"
                      >
                        <Download size={16} />
                      </button>
                    </>
                  )}
                  
                  {/* Fullscreen */}
                  <button 
                    onClick={toggleFullscreen}
                    className="p-1.5 sm:p-2 text-white hover:bg-white/10 rounded-full transition-all hover:scale-110"
                    title="Toggle Fullscreen"
                  >
                    {isFullscreen ? <Minimize size={isMobile ? 16 : 18} /> : <Maximize size={isMobile ? 16 : 18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Loading Spinner */}
          {!videoRef.current?.readyState && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="w-8 h-8 sm:w-12 sm:h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
          
          {/* Gesture Indicators */}
          {gestureControl && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-4 transform -translate-y-1/2 text-white/50 text-xs">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 border border-white/30 rounded-full flex items-center justify-center">
                    <Volume2 size={12} />
                  </div>
                  <span className="hidden sm:block">Volume</span>
                </div>
              </div>
              <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 text-white/50 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 border border-white/30 rounded-full flex items-center justify-center">
                    <SkipBack size={12} />
                  </div>
                  <span className="hidden sm:block">Seek</span>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 border border-white/30 rounded-full flex items-center justify-center">
                    <SkipForward size={12} />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Feature Indicators */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {aiEnhancement && (
              <div className="bg-blue-500/20 backdrop-blur-sm rounded-full px-2 sm:px-3 py-1 text-blue-400 text-xs flex items-center gap-1">
                <Zap size={10} />
                <span className="hidden sm:inline">AI Enhanced</span>
              </div>
            )}
            
            {visualizerActive && (
              <div className="bg-purple-500/20 backdrop-blur-sm rounded-full px-2 sm:px-3 py-1 text-purple-400 text-xs flex items-center gap-1">
                <Waves size={10} />
                <span className="hidden sm:inline">Visualizer</span>
              </div>
            )}
          </div>
        </div>
        
        {/* External Control Panel - Only on larger screens */}
        {!isMobile && (
          <div className="mt-4 bg-gradient-to-r from-gray-900 to-black rounded-xl p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                <Star size={14} className="text-yellow-400" />
                Experience Controls
              </h3>
              <div className="flex items-center gap-2 text-xs text-white/60">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Live Enhancements Active
              </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-white/80 text-xs flex items-center gap-1">
                  <Camera size={12} />
                  Video Quality
                </label>
                <select 
                  value={qualityMode}
                  onChange={(e) => setQualityMode(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-white/40"
                >
                  <option value="auto">Auto</option>
                  <option value="4k">4K Ultra</option>
                  <option value="1080p">1080p HD</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-white/80 text-xs flex items-center gap-1">
                  <Palette size={12} />
                  Effect Theme
                </label>
                <select 
                  value={particleTheme}
                  onChange={(e) => setParticleTheme(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-white/40"
                >
                  <option value="electric">Electric</option>
                  <option value="fire">Fire</option>
                  <option value="water">Ocean</option>
                  <option value="cosmic">Cosmic</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-white/80 text-xs flex items-center gap-1">
                  <FastForward size={12} />
                  Playback Speed
                </label>
                <input
                  type="range"
                  min="0.25"
                  max="3"
                  step="0.25"
                  value={playbackRate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value);
                    setPlaybackRate(rate);
                    if (videoRef.current) videoRef.current.playbackRate = rate;
                  }}
                  className="w-full h-1"
                />
                <div className="text-center text-white/60 text-xs">{playbackRate}x</div>
              </div>
              
              <div className="space-y-1">
                <label className="text-white/80 text-xs flex items-center gap-1">
                  <Mic size={12} />
                  Audio Level
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 transition-all duration-100"
                      style={{ width: `${volume * 100}%` }}
                    />
                  </div>
                  <span className="text-white/60 text-xs w-8">{Math.round(volume * 100)}</span>
                </div>
              </div>
            </div>
            
            {/* Feature Toggles */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { key: 'aiEnhancement', label: 'AI Enhance', icon: Zap, active: aiEnhancement, setter: setAiEnhancement },
                  { key: 'visualizer', label: 'Visualizer', icon: Eye, active: visualizerActive, setter: setVisualizerActive },
                  { key: 'ambient', label: 'Ambient', icon: Sun, active: ambientLighting, setter: setAmbientLighting },
                  { key: 'gesture', label: 'Gesture', icon: Wind, active: gestureControl, setter: setGestureControl },
                  { key: 'smart', label: 'Smart AI', icon: RotateCcw, active: smartRewind, setter: setSmartRewind },
                  { key: 'immersive', label: 'Immerse', icon: Maximize, active: immersiveMode, setter: setImmersiveMode }
                ].map(({ key, label, icon: Icon, active, setter }) => (
                  <button
                    key={key}
                    onClick={() => setter(!active)}
                    className={cn(
                      "p-2 rounded-lg transition-all hover:scale-105 flex flex-col items-center gap-1",
                      active 
                        ? "bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-white border border-blue-400/30" 
                        : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
                    )}
                  >
                    <Icon size={14} />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;