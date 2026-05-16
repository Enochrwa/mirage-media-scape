import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Heart,
  Share2,
  BookmarkPlus,
  Globe,
  MoreHorizontal,
  Settings,
  Zap,
  Eye,
  Palette,
  Rewind,
  FastForward,
  RotateCcw,
  RotateCw,
  Monitor,
  Smartphone,
  Tablet,
  PictureInPicture,
  Download,
  Subtitles,
  Filter,
  Sparkles,
  Wind,
  Waves,
  Sun,
  Moon,
  Star,
  Camera,
  Mic,
  X,
  Repeat,
} from 'lucide-react';
import { SubtitleCue, parseSRT } from '@/lib/utils';
import { usePlayerStore } from '@/store/usePlayerStore';
import SubtitleManager from './SubtitleManager';
import { VideoDecodeEngine } from '@/engines/VideoDecodeEngine';
import { MediaFile } from '@/types/media';
import { client } from '@/api/client';
import { useNavigate, useLocation } from 'react-router-dom';

interface AudioTrack {
  stream_index: number;
  language?: string;
  codec_name?: string;
  channels?: number;
  sample_rate?: number;
}

interface Chapter {
  id: number;
  chapter_index: number;
  title?: string;
  start_time_ms: number;
  end_time_ms?: number;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Particle system for visual effects
const ParticleSystem = ({ isActive, theme }: { isActive: boolean; theme: string }) => {
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      x: number;
      y: number;
      size: number;
      opacity: number;
      vx: number;
      vy: number;
    }>
  >([]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setParticles((prev) => {
        const newParticles = prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            opacity: p.opacity - 0.02,
          }))
          .filter((p) => p.opacity > 0);

        // Add new particles
        if (Math.random() > 0.7) {
          newParticles.push({
            id: Math.random(),
            x: Math.random() * window.innerWidth,
            y: window.innerHeight,
            size: Math.random() * 4 + 2,
            opacity: 1,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 3 - 1,
          });
        }

        return newParticles.slice(-30); // Limit particles
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={cn(
            'absolute rounded-full',
            theme === 'fire'
              ? 'bg-orange-400'
              : theme === 'water'
                ? 'bg-blue-400'
                : theme === 'electric'
                  ? 'bg-yellow-400'
                  : 'bg-purple-400',
          )}
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            opacity: particle.opacity,
            boxShadow: `0 0 ${particle.size * 2}px currentColor`,
          }}
        />
      ))}
    </div>
  );
};

const VideoPlayer: React.FC = () => {
  const {
    currentFile,
    setCurrentTime: updateCurrentTime,
    setDuration: updateDuration,
    playbackEngine: pe,
    isPlaying: storeIsPlaying,
  } = usePlayerStore();
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State management
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(currentFile?.duration || 0);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const [isPiP, setIsPiP] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [gestureControl, setGestureControl] = useState(false);
  const [smartRewind, setSmartRewind] = useState(false);
  const [qualityMode, setQualityMode] = useState('auto');
  const [devicePreview, setDevicePreview] = useState('desktop');
  const [isMobile, setIsMobile] = useState(false);
  const [hwDecodeSupported, setHwDecodeSupported] = useState<Record<string, boolean>>({});
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showChapters, setShowChapters] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hoverThumb, setHoverThumb] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState(0);
  const [hoverPos, setHoverPos] = useState(0);
  const [aspectRatio, setAspectRatio] = useState('fit');
  const [rotation, setRotation] = useState(0);
  const [mirrorFlip, setMirrorFlip] = useState(false);
  const [brightness, setBrightness] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  const [hue, setHue] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pinchStartScale, setPinchStartScale] = useState(1.0);
  const [isPinching, setIsPinching] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Probe hardware decode
    VideoDecodeEngine.probeHardwareDecode().then(setHwDecodeSupported);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Audio visualizer setup
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !visualizerActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const analyser = pe.getAnalyser();

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationFrameId: number;

    const draw = () => {
      if (!visualizerActive) return;

      animationFrameId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
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
      cancelAnimationFrame(animationFrameId);
    };
  }, [visualizerActive, pe]);

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
        setIsPinching(false);
      } else if (e.touches.length === 2) {
        setIsPinching(true);
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        setPinchStartScale(dist);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && !isPinching) {
        const deltaX = e.touches[0].clientX - startX;
        const deltaY = e.touches[0].clientY - startY;

        // Horizontal swipe for seeking - visual feedback only
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
          const seekDelta = (deltaX / window.innerWidth) * 90; // 90 seconds max
          const newTime = Math.max(0, Math.min(duration, startTime + seekDelta));
          setCurrentTime(newTime);
        }

        // Vertical swipe
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
          const isLeftHalf = e.touches[0].clientX < window.innerWidth / 2;
          if (isLeftHalf) {
            const brightnessDelta = -(deltaY / window.innerHeight);
            setBrightness((prev) => Math.max(0.5, Math.min(2.0, prev + brightnessDelta)));
          } else {
            const volumeDelta = -(deltaY / window.innerHeight);
            const newVolume = Math.max(0, Math.min(1, volume + volumeDelta));
            setVolume(newVolume);
            pe.setVolume(newVolume);
          }
        }
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const factor = dist / pinchStartScale;
        setScale((prev) => Math.max(1, Math.min(3, prev * factor)));
        setPinchStartScale(dist);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (scale < 1.05) setScale(1);

      // Commit horizontal seek on end
      if (!isPinching && e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - startX;
        const deltaY = e.changedTouches[0].clientY - startY;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
          if (videoRef.current) {
            videoRef.current.currentTime = currentTime;
          }
        }
      }
      if (e.touches.length === 0) setIsPinching(false);
    };

    const container = videoContainerRef.current;
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gestureControl, volume, currentTime, duration, isPinching, pinchStartScale, scale, pe]);

  // Smart rewind feature
  const handleSmartRewind = useCallback(() => {
    if (!smartRewind || !videoRef.current) return;

    // Rewind to last significant moment (simulate scene detection)
    const smartPositions = [0, 30, 65, 120, 180, 240, 300, 360, 420, 480];
    const currentPos = Math.floor(currentTime);
    const previousScene = smartPositions.reverse().find((pos) => pos < currentPos) || 0;

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
    setHasInteracted(true);
    usePlayerStore.getState().togglePlayback();
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
    pe.setVolume(vol);
    if (vol > 0 && muted) {
      setMuted(false);
    } else if (vol === 0) {
      setMuted(true);
    }
  };

  const handleProgressChange = (newValue: number[]) => {
    const time = newValue[0];
    setCurrentTime(time);
    pe.seek(time);
  };

  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * duration;
    setHoverTime(time);
    setHoverPos(x);

    if (currentFile?.id) {
      setHoverThumb(`${API_BASE}/api/tracks/${currentFile.id}/thumbnail-at?at=${Math.floor(time)}`);
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

  const toggleLoop = () => {
    pe.abLoop.toggle();
    setIsLooping(pe.abLoop.isActive);
  };

  const setPointA = () => {
    pe.abLoop.setA(currentTime);
    setIsLooping(pe.abLoop.isActive);
  };
  const setPointB = () => {
    pe.abLoop.setB(currentTime);
    setIsLooping(pe.abLoop.isActive);
  };

  const handleSubtitleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsedCues = parseSRT(content);
      setCues(parsedCues);
      setSubtitlesEnabled(true);
    };
    reader.readAsText(file);
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;

    try {
      if (isPiP) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        }
      } else {
        if (document.pictureInPictureEnabled) {
          await videoRef.current.requestPictureInPicture();
        } else {
          setIsPiP(true);
        }
      }
      setIsPiP(!isPiP);
    } catch (error) {
      console.error('PiP error:', error);
    }
  };

  const nextChapter = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime * 1000;
    const next = chapters.find((c) => c.start_time_ms > time + 500);
    if (next) videoRef.current.currentTime = next.start_time_ms / 1000;
  };

  const prevChapter = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime * 1000;
    const current = [...chapters].reverse().find((c) => c.start_time_ms <= time);
    if (current) {
      if (time > current.start_time_ms + 2000) {
        videoRef.current.currentTime = current.start_time_ms / 1000;
      } else {
        const idx = chapters.indexOf(current);
        if (idx > 0) {
          videoRef.current.currentTime = chapters[idx - 1].start_time_ms / 1000;
        }
      }
    }
  };

  const switchAudioTrack = async (index: number) => {
    if (!currentFile || !videoRef.current) return;
    const time = videoRef.current.currentTime;
    setSelectedAudioTrack(index);
    const newSrc = `${currentFile.file}${currentFile.file?.includes('?') ? '&' : '?'}audio_stream=${index}`;
    videoRef.current.src = newSrc;
    videoRef.current.load();
    const onCanPlay = () => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        if (isPlaying) videoRef.current.play();
      }
      videoRef.current?.removeEventListener('canplay', onCanPlay);
    };
    videoRef.current.addEventListener('canplay', onCanPlay);
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
    if (!videoRef.current || !currentFile) return;

    pe.loadVideo(currentFile, videoRef.current);

    // Load persisted settings
    if (currentFile.id) {
      client.get(`/tracks/${currentFile.id}`).then((res) => {
        const track = res.data;
        if (track.aspect_ratio_override) setAspectRatio(track.aspect_ratio_override);
        if (track.rotation_degrees) setRotation(track.rotation_degrees);
        if (track.mirror_flip) setMirrorFlip(!!track.mirror_flip);
      });
      client.get(`/tracks/${currentFile.id}/audio-streams`).then((res) => {
        setAudioTracks(res.data || []);
      });
      client.get(`/tracks/${currentFile.id}/chapters`).then((res) => {
        setChapters(res.data || []);
      });
    }
  }, [currentFile, pe]);

  useEffect(() => {
    if (currentFile?.id) {
      // Debounce persistence
      const timer = setTimeout(() => {
        client.patch(`/tracks/${currentFile.id}/metadata`, {
          aspect_ratio_override: aspectRatio,
          rotation_degrees: rotation,
          mirror_flip: mirrorFlip ? 1 : 0,
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentFile?.id, aspectRatio, rotation, mirrorFlip]);

  useEffect(() => {
    setIsPlaying(storeIsPlaying);
  }, [storeIsPlaying]);

  useEffect(() => {
    const handleNavigateAway = () => {
      const autoPiP = localStorage.getItem('ZOVYRA_auto_pip') === 'true';
      if (
        autoPiP &&
        isPlaying &&
        hasInteracted &&
        videoRef.current &&
        !document.pictureInPictureElement
      ) {
        if (document.pictureInPictureEnabled) {
          videoRef.current.requestPictureInPicture().catch(console.error);
        }
      }
    };
    return () => handleNavigateAway();
  }, [location.pathname, isPlaying, hasInteracted]);

  useEffect(() => {
    if ('mediaSession' in navigator && videoRef.current) {
      navigator.mediaSession.setActionHandler('seekforward', () => {
        if (videoRef.current) videoRef.current.currentTime += 10;
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        if (videoRef.current) videoRef.current.currentTime -= 10;
      });
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);

      // Handle A-B Loop
      if (pe.abLoop.isActive && pe.abLoop.pointA !== null && pe.abLoop.pointB !== null) {
        if (time >= pe.abLoop.pointB) {
          video.currentTime = pe.abLoop.pointA;
        }
      }

      // Handle Subtitles
      if (subtitlesEnabled && cues.length > 0) {
        const cue = cues.find((c) => time >= c.start && time <= c.end);
        setActiveCue(cue || null);
      }
    };
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      updateDuration(video.duration);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [pe, updateDuration, subtitlesEnabled, cues]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-2 sm:p-4">
      <div className="mx-auto flex h-[95vh] w-full max-w-[95vw] flex-col">
        {/* Main Video Container */}
        <div
          className={cn(
            'relative flex-1 overflow-hidden rounded-xl transition-all duration-500 sm:rounded-2xl',
            immersiveMode && 'rounded-none',
            ambientLighting && 'transition-shadow duration-300',
            'bg-black shadow-2xl',
            // Device preview styles
            devicePreview === 'mobile'
              ? 'mx-auto aspect-[9/16] max-w-sm'
              : devicePreview === 'tablet'
                ? 'mx-auto aspect-[4/3] max-w-4xl'
                : 'h-full w-full',
          )}
          ref={videoContainerRef}
          onMouseMove={handleMouseMove}
          style={{
            willChange: 'transform',
            transform: `rotate(${rotation}deg) scaleX(${mirrorFlip ? -1 : 1}) scale(${scale})`,
          }}
        >
          {/* Particle System */}
          <ParticleSystem isActive={visualizerActive} theme={particleTheme} />

          {/* Audio Visualizer Canvas */}
          <canvas
            ref={canvasRef}
            className={cn(
              'pointer-events-none absolute inset-0 mix-blend-screen transition-opacity',
              visualizerActive ? 'opacity-60' : 'opacity-0',
            )}
            width={800}
            height={400}
          />

          {/* Main Video */}
          <video
            ref={videoRef}
            className={cn(
              'h-full w-full cursor-pointer transition-all duration-300',
              aspectRatio === 'fill' || aspectRatio === 'stretch' || aspectRatio === 'anamorphic'
                ? 'object-fill'
                : aspectRatio === 'fit'
                  ? 'object-contain'
                  : 'object-cover',
            )}
            src={currentFile?.file}
            onClick={togglePlayback}
            playsInline
            style={{
              filter: aiEnhancement
                ? `contrast(${1.2 * contrast}) saturate(${1.3 * saturation}) brightness(${1.1 * brightness}) hue-rotate(${hue}deg)`
                : `contrast(${contrast}) saturate(${saturation}) brightness(${brightness}) hue-rotate(${hue}deg)`,
              aspectRatio:
                aspectRatio === '16:9'
                  ? '16/9'
                  : aspectRatio === '4:3'
                    ? '4/3'
                    : aspectRatio === 'anamorphic'
                      ? '2.39/1'
                      : 'auto',
            }}
          />

          {/* Top Controls Overlay */}
          <div
            className={cn(
              'absolute left-0 right-0 top-0 bg-gradient-to-b from-black/90 via-black/60 to-transparent p-3 transition-all duration-300 sm:p-6',
              controlsVisible || showSettings ? 'opacity-100' : 'opacity-0',
            )}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1 space-y-1 text-white">
                <h3 className="truncate text-sm font-bold sm:text-xl">{currentFile?.title}</h3>
                <p className="truncate text-xs opacity-80 sm:text-sm">{currentFile?.artist}</p>
                <div className="flex items-center gap-2 text-xs opacity-70 sm:gap-4">
                  <span>Quality: {qualityMode.toUpperCase()}</span>
                  <span>Rate: {playbackRate}x</span>
                  {aiEnhancement && <span className="text-blue-400">AI Enhanced</span>}
                </div>
              </div>

              <div className="ml-2 flex flex-shrink-0 gap-1 sm:gap-2">
                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={cn(
                    'rounded-full p-1.5 backdrop-blur-sm transition-all hover:scale-110 sm:p-2',
                    isFavorite
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-white/10 text-white hover:bg-white/20',
                  )}
                >
                  <Heart size={isMobile ? 16 : 20} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>

                <button
                  onClick={() => navigator.clipboard.writeText(currentFile?.title || '')}
                  className="rounded-full bg-white/10 p-1.5 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/20 sm:p-2"
                >
                  <Share2 size={isMobile ? 16 : 20} />
                </button>

                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(
                    'rounded-full p-1.5 backdrop-blur-sm transition-all hover:scale-110 sm:p-2',
                    showSettings
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-white/10 text-white hover:bg-white/20',
                  )}
                >
                  <Settings size={isMobile ? 16 : 20} />
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Settings Panel */}
          {showSettings && (
            <div className="absolute right-2 top-16 z-50 max-h-80 w-72 overflow-y-auto rounded-xl bg-black/95 p-3 text-white backdrop-blur-md sm:right-4 sm:top-20 sm:w-80 sm:p-4">
              <h4 className="mb-3 flex items-center gap-2 font-semibold sm:mb-4">
                <Sparkles size={16} />
                Advanced Controls
              </h4>

              <div className="space-y-3 sm:space-y-4">
                {/* Feature Toggles */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      key: 'aiEnhancement',
                      label: 'AI Enhance',
                      icon: Zap,
                      active: aiEnhancement,
                      setter: setAiEnhancement,
                      color: 'blue',
                    },
                    {
                      key: 'visualizer',
                      label: 'Visualizer',
                      icon: Eye,
                      active: visualizerActive,
                      setter: setVisualizerActive,
                      color: 'purple',
                    },
                    {
                      key: 'ambient',
                      label: 'Ambient',
                      icon: Sun,
                      active: ambientLighting,
                      setter: setAmbientLighting,
                      color: 'orange',
                    },
                    {
                      key: 'gesture',
                      label: 'Gesture',
                      icon: Wind,
                      active: gestureControl,
                      setter: setGestureControl,
                      color: 'green',
                    },
                  ].map(({ key, label, icon: Icon, active, setter, color }) => (
                    <button
                      key={key}
                      onClick={() => setter(!active)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg p-2 text-sm transition-all hover:scale-105 sm:p-3',
                        active
                          ? `bg-${color}-500/20 text-${color}-400 border border-${color}-400/30`
                          : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                {/* Device Preview */}
                <div className="space-y-2">
                  <span className="flex items-center gap-2 text-sm">
                    <Monitor size={14} className="flex-shrink-0 text-orange-400" />
                    Device Preview
                  </span>
                  <div className="flex gap-2">
                    {[
                      { key: 'desktop', icon: Monitor, label: 'Desktop' },
                      { key: 'tablet', icon: Tablet, label: 'Tablet' },
                      { key: 'mobile', icon: Smartphone, label: 'Mobile' },
                    ].map(({ key, icon: Icon, label }) => (
                      <button
                        key={key}
                        onClick={() => setDevicePreview(key)}
                        className={cn(
                          'flex flex-1 flex-col items-center gap-1 rounded-lg p-2 transition-all',
                          devicePreview === key
                            ? 'bg-white/20 text-white'
                            : 'bg-white/5 text-white/60 hover:bg-white/10',
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
                  <span className="flex items-center gap-2 text-sm">
                    <Palette size={14} className="flex-shrink-0 text-green-400" />
                    Particle Theme
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {['electric', 'fire', 'water', 'cosmic'].map((theme) => (
                      <button
                        key={theme}
                        onClick={() => setParticleTheme(theme)}
                        className={cn(
                          'rounded-lg px-3 py-2 text-xs capitalize transition-all',
                          particleTheme === theme
                            ? 'bg-white/20 text-white'
                            : 'bg-white/5 text-white/60 hover:bg-white/10',
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

          <SubtitleManager />

          {/* Bottom Controls */}
          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 transition-all duration-300 sm:p-6',
              controlsVisible || showSettings ? 'opacity-100' : 'opacity-0',
            )}
          >
            <div className="space-y-3 sm:space-y-4">
              {/* Progress Bar */}
              <div className="flex items-center gap-2 text-white sm:gap-3">
                <span className="w-10 text-right font-mono text-xs sm:w-12">
                  {formatTime(currentTime)}
                </span>
                <div className="group relative flex-1">
                  <input
                    type="range"
                    min="0"
                    max={duration}
                    value={currentTime}
                    onChange={(e) => handleProgressChange([parseFloat(e.target.value)])}
                    className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 sm:h-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125 group-hover:[&::-webkit-slider-thumb]:scale-125 sm:[&::-webkit-slider-thumb]:h-4 sm:[&::-webkit-slider-thumb]:w-4"
                    style={{
                      background: `linear-gradient(to right, #ffffff ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%)`,
                    }}
                  />
                </div>
                <span className="w-10 font-mono text-xs sm:w-12">{formatTime(duration)}</span>
              </div>

              {/* Main Controls */}
              <div className="flex items-center justify-between">
                {/* Left Controls */}
                <div className="flex items-center gap-1 sm:gap-3">
                  {!isMobile && (
                    <>
                      <button
                        onClick={handleSmartRewind}
                        className="rounded-full p-1.5 text-white transition-all hover:scale-110 hover:bg-white/10 sm:p-2"
                        title="Smart Rewind"
                      >
                        <RotateCcw size={16} />
                      </button>

                      <button className="rounded-full p-1.5 text-white transition-all hover:scale-110 hover:bg-white/10 sm:p-2">
                        <SkipBack size={16} />
                      </button>
                    </>
                  )}

                  {/* Enhanced Play Button */}
                  <button
                    onClick={togglePlayback}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg transition-all hover:scale-105 hover:bg-white/90 sm:h-12 sm:w-12"
                  >
                    {isPlaying ? (
                      <Pause size={isMobile ? 18 : 20} />
                    ) : (
                      <Play size={isMobile ? 18 : 20} className="ml-0.5" />
                    )}
                  </button>

                  {!isMobile && (
                    <>
                      <button className="rounded-full p-1.5 text-white transition-all hover:scale-110 hover:bg-white/10 sm:p-2">
                        <SkipForward size={16} />
                      </button>

                      {/* Playback Speed */}
                      <div className="group relative">
                        <button className="flex items-center gap-1 rounded-full p-1.5 text-white transition-all hover:scale-110 hover:bg-white/10 sm:p-2">
                          <FastForward size={14} />
                          <span className="text-xs">{playbackRate}x</span>
                        </button>
                        <div className="absolute bottom-full left-0 mb-2 rounded-lg bg-black/90 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="flex flex-col gap-1">
                            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                              <button
                                key={rate}
                                onClick={() => {
                                  setPlaybackRate(rate);
                                  if (videoRef.current) videoRef.current.playbackRate = rate;
                                }}
                                className={cn(
                                  'whitespace-nowrap rounded px-3 py-1 text-xs transition-colors',
                                  playbackRate === rate
                                    ? 'bg-white/20 text-white'
                                    : 'text-white/70 hover:text-white',
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
                      className="rounded-full p-1.5 text-white transition-all hover:scale-110 hover:bg-white/10 sm:p-2"
                    >
                      <VolumeIcon />
                    </button>
                    {!isMobile && (
                      <>
                        <div className="group relative w-16 sm:w-24">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => handleVolumeChange([parseFloat(e.target.value)])}
                            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125 sm:[&::-webkit-slider-thumb]:h-3 sm:[&::-webkit-slider-thumb]:w-3"
                            style={{
                              background: `linear-gradient(to right, #ffffff ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`,
                            }}
                          />
                        </div>
                        <span className="w-6 text-center text-xs text-white/70 sm:w-8">
                          {Math.round(volume * 100)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Additional Controls */}
                  {!isMobile && (
                    <>
                      {/* A-B Loop */}
                      <div className="flex items-center rounded-full bg-white/5 px-1">
                        <button
                          onClick={setPointA}
                          className={cn(
                            'rounded-full px-2 py-1 text-[10px] font-bold transition-all',
                            pe.abLoop.pointA !== null ? 'text-purple-400' : 'text-white/40',
                          )}
                        >
                          A
                        </button>
                        <button
                          onClick={setPointB}
                          className={cn(
                            'rounded-full px-2 py-1 text-[10px] font-bold transition-all',
                            pe.abLoop.pointB !== null ? 'text-purple-400' : 'text-white/40',
                          )}
                        >
                          B
                        </button>
                        <button
                          onClick={toggleLoop}
                          disabled={pe.abLoop.pointA === null || pe.abLoop.pointB === null}
                          className={cn(
                            'rounded-full p-1.5 transition-all',
                            isLooping ? 'text-purple-400' : 'text-white/60 disabled:opacity-30',
                          )}
                        >
                          <Repeat size={14} />
                        </button>
                      </div>

                      {/* Subtitles */}
                      <div className="group relative">
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept=".srt,.vtt"
                          onChange={handleSubtitleFileChange}
                        />
                        <button
                          onClick={() => {
                            if (cues.length === 0) {
                              fileInputRef.current?.click();
                            } else {
                              setSubtitlesEnabled(!subtitlesEnabled);
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }}
                          className={cn(
                            'rounded-full p-1.5 transition-all hover:scale-110 sm:p-2',
                            subtitlesEnabled
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'text-white hover:bg-white/10',
                          )}
                          title={
                            cues.length === 0
                              ? 'Load Subtitles'
                              : 'Toggle Subtitles (Right-click to change)'
                          }
                        >
                          <Subtitles size={16} />
                        </button>
                      </div>

                      {/* Picture in Picture */}
                      <button
                        onClick={togglePiP}
                        className={cn(
                          'rounded-full p-1.5 transition-all hover:scale-110 sm:p-2',
                          isPiP ? 'bg-blue-500/20 text-blue-400' : 'text-white hover:bg-white/10',
                        )}
                        title="Picture in Picture"
                      >
                        <PictureInPicture size={16} />
                      </button>

                      {/* Quality Selector */}
                      <div className="group relative">
                        <button className="flex items-center gap-1 rounded-full p-1.5 text-white transition-all hover:scale-110 hover:bg-white/10 sm:p-2">
                          <Filter size={14} />
                          <span className="text-xs uppercase">{qualityMode}</span>
                        </button>
                        <div className="absolute bottom-full right-0 mb-2 rounded-lg bg-black/90 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="flex flex-col gap-1">
                            {['auto', '4k', '1080p', '720p', '480p'].map((quality) => (
                              <button
                                key={quality}
                                onClick={() => setQualityMode(quality)}
                                className={cn(
                                  'whitespace-nowrap rounded px-3 py-1 text-left text-xs transition-colors',
                                  qualityMode === quality
                                    ? 'bg-white/20 text-white'
                                    : 'text-white/70 hover:text-white',
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
                          if (!currentFile) return;
                          const link = document.createElement('a');
                          link.href = currentFile.file ?? '';
                          link.download = `${currentFile.title}.mp4`;
                          link.click();
                        }}
                        className="rounded-full p-1.5 text-white transition-all hover:scale-110 hover:bg-white/10 sm:p-2"
                        title="Download Video"
                      >
                        <Download size={16} />
                      </button>
                    </>
                  )}

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="rounded-full p-1.5 text-white transition-all hover:scale-110 hover:bg-white/10 sm:p-2"
                    title="Toggle Fullscreen"
                  >
                    {isFullscreen ? (
                      <Minimize size={isMobile ? 16 : 18} />
                    ) : (
                      <Maximize size={isMobile ? 16 : 18} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Loading Spinner */}
          {!videoRef.current?.readyState || videoRef.current?.readyState < 2 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white sm:h-12 sm:w-12" />
            </div>
          ) : null}

          {/* Gesture Indicators */}
          {gestureControl && (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 transform text-xs text-white/50">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 sm:h-8 sm:w-8">
                    <Volume2 size={12} />
                  </div>
                  <span className="hidden sm:block">Volume</span>
                </div>
              </div>
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 transform text-xs text-white/50">
                <div className="flex items-center gap-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 sm:h-8 sm:w-8">
                    <SkipBack size={12} />
                  </div>
                  <span className="hidden sm:block">Seek</span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 sm:h-8 sm:w-8">
                    <SkipForward size={12} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Subtitle */}
          {subtitlesEnabled && activeCue && (
            <div className="pointer-events-none absolute bottom-24 left-0 right-0 flex justify-center px-4">
              <div className="max-w-[80%] rounded border border-white/10 bg-black/60 px-4 py-2 text-center text-lg font-medium text-white shadow-2xl backdrop-blur-md sm:text-2xl">
                {activeCue.text}
              </div>
            </div>
          )}

          {/* Feature Indicators */}
          <div className="absolute left-4 top-4 flex flex-col gap-2">
            {aiEnhancement && (
              <div className="flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-400 backdrop-blur-sm sm:px-3">
                <Zap size={10} />
                <span className="hidden sm:inline">AI Enhanced</span>
              </div>
            )}

            {visualizerActive && (
              <div className="flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-400 backdrop-blur-sm sm:px-3">
                <Waves size={10} />
                <span className="hidden sm:inline">Visualizer</span>
              </div>
            )}

            {Object.values(hwDecodeSupported).some((v) => v) && (
              <div className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400 backdrop-blur-sm sm:px-3">
                <Zap size={10} />
                <span className="hidden sm:inline">HW Decode</span>
              </div>
            )}
          </div>
        </div>

        {/* External Control Panel - Only on larger screens */}
        {!isMobile && (
          <div className="mt-4 flex-shrink-0 rounded-xl bg-gradient-to-r from-gray-900 to-black p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Star size={14} className="text-yellow-400" />
                Experience Controls
              </h3>
              <div className="flex items-center gap-2 text-xs text-white/60">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                Live Enhancements Active
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-xs text-white/80">
                  <Camera size={12} />
                  Video Quality
                </label>
                <select
                  value={qualityMode}
                  onChange={(e) => setQualityMode(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white focus:border-white/40 focus:outline-none"
                >
                  <option value="auto">Auto</option>
                  <option value="4k">4K Ultra</option>
                  <option value="1080p">1080p HD</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-1 text-xs text-white/80">
                  <Palette size={12} />
                  Effect Theme
                </label>
                <select
                  value={particleTheme}
                  onChange={(e) => setParticleTheme(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white focus:border-white/40 focus:outline-none"
                >
                  <option value="electric">Electric</option>
                  <option value="fire">Fire</option>
                  <option value="water">Ocean</option>
                  <option value="cosmic">Cosmic</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-1 text-xs text-white/80">
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
                  className="h-1 w-full"
                />
                <div className="text-center text-xs text-white/60">{playbackRate}x</div>
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-1 text-xs text-white/80">
                  <Mic size={12} />
                  Audio Level
                </label>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 transition-all duration-100"
                      style={{ width: `${volume * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs text-white/60">{Math.round(volume * 100)}</span>
                </div>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
                {[
                  {
                    key: 'aiEnhancement',
                    label: 'AI Enhance',
                    icon: Zap,
                    active: aiEnhancement,
                    setter: setAiEnhancement,
                  },
                  {
                    key: 'visualizer',
                    label: 'Visualizer',
                    icon: Eye,
                    active: visualizerActive,
                    setter: setVisualizerActive,
                  },
                  {
                    key: 'ambient',
                    label: 'Ambient',
                    icon: Sun,
                    active: ambientLighting,
                    setter: setAmbientLighting,
                  },
                  {
                    key: 'gesture',
                    label: 'Gesture',
                    icon: Wind,
                    active: gestureControl,
                    setter: setGestureControl,
                  },
                  {
                    key: 'smart',
                    label: 'Smart AI',
                    icon: RotateCcw,
                    active: smartRewind,
                    setter: setSmartRewind,
                  },
                  {
                    key: 'immersive',
                    label: 'Immerse',
                    icon: Maximize,
                    active: immersiveMode,
                    setter: setImmersiveMode,
                  },
                ].map(({ key, label, icon: Icon, active, setter }) => (
                  <button
                    key={key}
                    onClick={() => setter(!active)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg p-2 transition-all hover:scale-105',
                      active
                        ? 'border border-blue-400/30 bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-white'
                        : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white',
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
