import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { cn, formatDuration, API_BASE } from '@/lib/utils';
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
  Settings,
  Zap,
  PictureInPicture,
  Subtitles,
  List,
  ChevronLeft,
  ChevronRight,
  X,
  Headphones,
  RotateCcw,
  Sun,
  Contrast,
  Droplets,
  FlipHorizontal,
  Monitor,
  Download,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import SubtitleManager from './SubtitleManager';
import { VideoDecodeEngine } from '@/engines/VideoDecodeEngine';
import { client } from '@/api/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

interface VideoPlayerProps {
  onClose?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ onClose }) => {
  const {
    currentFile,
    setCurrentTime: updateStoreCurrentTime,
    setDuration: updateStoreDuration,
    playbackEngine: pe,
    isPlaying: storeIsPlaying,
  } = usePlayerStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(currentFile?.duration || 0);
  const [volume, setVolume] = useState(0.8);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hwDecodeSupported, setHwDecodeSupported] = useState<Record<string, boolean>>({});
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showChapterList, setShowChapterList] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const [hoverPercent, setHoverPercent] = useState(0);
  const [showHoverTime, setShowHoverTime] = useState(false);
  const [skipIndicator, setSkipIndicator] = useState<'forward' | 'backward' | null>(null);
  const [volumeIndicator, setVolumeIndicator] = useState<number | null>(null);

  // Visual settings
  const [aspectRatio, setAspectRatio] = useState('fit');
  const [rotation, setRotation] = useState(0);
  const [mirrorFlip, setMirrorFlip] = useState(false);
  const [brightness, setBrightness] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  const [hue, setHue] = useState(0);
  const [scale, setScale] = useState(1.0);

  // Load video src when currentFile changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentFile) return;

    const url = `${API_BASE}/api/stream/${encodeURIComponent(currentFile.id)}`;
    video.src = url;
    video.load();

    const onLoadedMetadata = () => {
      updateStoreDuration(video.duration);
      setDuration(video.duration);
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      updateStoreCurrentTime(video.currentTime);
    };
    const onEnded = () => usePlayerStore.getState().nextTrack();
    const onCanPlay = () => {
      if (usePlayerStore.getState().isPlaying) {
        video.play().catch((err) => console.warn('[VideoPlayer] Autoplay blocked:', err));
      }
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('canplay', onCanPlay, { once: true });

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('canplay', onCanPlay);
      video.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFile?.id]);

  // Sync play/pause from store
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentFile) return;
    if (storeIsPlaying) {
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        video.play().catch(console.error);
      }
    } else {
      video.pause();
    }
  }, [storeIsPlaying, currentFile]);

  // Volume sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = muted ? 0 : volume;
  }, [volume, muted]);

  // Playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    VideoDecodeEngine.probeHardwareDecode().then(setHwDecodeSupported);
  }, []);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimeout]);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Load per-file data
  useEffect(() => {
    if (currentFile?.id) {
      client
        .get(`/api/tracks/${currentFile.id}`)
        .then((res) => {
          if (res.aspect_ratio_override) setAspectRatio(res.aspect_ratio_override);
          if (res.rotation_degrees) setRotation(res.rotation_degrees);
          if (res.mirror_flip) setMirrorFlip(!!res.mirror_flip);
        })
        .catch(() => {});
      client
        .get(`/api/tracks/${currentFile.id}/audio-streams`)
        .then(setAudioTracks)
        .catch(() => {});
      client
        .get(`/api/tracks/${currentFile.id}/chapters`)
        .then(setChapters)
        .catch(() => {});
    }
  }, [currentFile?.id]);

  // Error fallback to transcode
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleError = async () => {
      if (!currentFile) return;
      if (!video.src.includes('transcode=1')) {
        video.src = `${API_BASE}/api/stream/${currentFile.id}?transcode=1`;
        video.load();
        video.play().catch(console.error);
      }
    };
    video.addEventListener('error', handleError);
    return () => video.removeEventListener('error', handleError);
  }, [currentFile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const video = videoRef.current;
      if (!video) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          usePlayerStore.getState().togglePlayback();
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + (e.shiftKey ? 30 : 10));
          showSkip('forward');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - (e.shiftKey ? 30 : 10));
          showSkip('backward');
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(Math.max(0, volume - 0.1));
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'Escape':
          if (isFullscreen) document.exitFullscreen().catch(() => {});
          else onClose?.();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, isFullscreen]);

  const showSkip = (dir: 'forward' | 'backward') => {
    setSkipIndicator(dir);
    setTimeout(() => setSkipIndicator(null), 600);
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    if (v > 0) setMuted(false);
    setVolumeIndicator(Math.round(v * 100));
    setTimeout(() => setVolumeIndicator(null), 1200);
  };

  const toggleMute = () => {
    if (muted) {
      setMuted(false);
      setVolume(prevVolume || 0.8);
    } else {
      setPrevVolume(volume);
      setMuted(true);
    }
  };

  const togglePlayback = () => {
    usePlayerStore.getState().togglePlayback();
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
  };

  const toggleFullscreen = async () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      await videoContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  };

  const switchAudioTrack = async (index: number) => {
    if (!currentFile || !videoRef.current) return;
    const time = videoRef.current.currentTime;
    setSelectedAudioTrack(index);
    const url = new URL(currentFile.file || '', window.location.origin);
    url.searchParams.set('audio_stream', index.toString());
    const onLoaded = () => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        if (isPlaying) videoRef.current.play().catch(() => {});
      }
      videoRef.current?.removeEventListener('loadedmetadata', onLoaded);
    };
    videoRef.current.addEventListener('loadedmetadata', onLoaded);
    videoRef.current.src = url.toString();
    videoRef.current.load();
  };

  const nextChapter = () => {
    const next = chapters.find((c) => c.start_time_ms > currentTime * 1000 + 500);
    if (next) handleSeek(next.start_time_ms / 1000);
  };

  const prevChapter = () => {
    const curIdx = [...chapters]
      .reverse()
      .findIndex((c) => c.start_time_ms <= currentTime * 1000 + 10);
    const actualIdx = curIdx === -1 ? -1 : chapters.length - 1 - curIdx;
    if (actualIdx !== -1) {
      const cur = chapters[actualIdx];
      if (currentTime * 1000 > cur.start_time_ms + 2000) {
        handleSeek(cur.start_time_ms / 1000);
      } else if (actualIdx > 0) {
        handleSeek(chapters[actualIdx - 1].start_time_ms / 1000);
      } else {
        handleSeek(0);
      }
    } else {
      handleSeek(0);
    }
  };

  const videoFilter = useMemo(() => {
    return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hue}deg)`;
  }, [brightness, contrast, saturation, hue]);

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const currentChapter = chapters.find(
    (c) =>
      currentTime * 1000 >= c.start_time_ms &&
      (!c.end_time_ms || currentTime * 1000 < c.end_time_ms),
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={videoContainerRef}
        className="group relative flex h-full w-full select-none overflow-hidden bg-black"
        onMouseMove={resetControlsTimeout}
        onDoubleClick={toggleFullscreen}
        onClick={() => {
          if (!showChapterList) resetControlsTimeout();
        }}
      >
        {/* Video element */}
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            transform: `rotate(${rotation}deg) scaleX(${mirrorFlip ? -1 : 1}) scale(${scale})`,
          }}
        >
          <video
            ref={videoRef}
            className={cn(
              'max-h-full max-w-full',
              aspectRatio === 'fill' || aspectRatio === 'stretch'
                ? 'h-full w-full object-fill'
                : 'object-contain',
            )}
            style={{ filter: videoFilter }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        </div>

        {/* Subtitles */}
        <SubtitleManager />

        {/* Skip indicators */}
        {skipIndicator === 'backward' && (
          <div className="pointer-events-none absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping">
            <div className="flex flex-col items-center gap-1 rounded-xl bg-black/60 px-6 py-4 backdrop-blur-sm">
              <ChevronsLeft size={40} className="text-white" />
              <span className="text-xs font-bold text-white">10s</span>
            </div>
          </div>
        )}
        {skipIndicator === 'forward' && (
          <div className="pointer-events-none absolute right-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping">
            <div className="flex flex-col items-center gap-1 rounded-xl bg-black/60 px-6 py-4 backdrop-blur-sm">
              <ChevronsRight size={40} className="text-white" />
              <span className="text-xs font-bold text-white">10s</span>
            </div>
          </div>
        )}
        {volumeIndicator !== null && (
          <div className="pointer-events-none absolute left-1/2 top-8 -translate-x-1/2 animate-in fade-in">
            <div className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 backdrop-blur-sm">
              <VolumeIcon size={16} className="text-white" />
              <span className="text-sm font-bold text-white">{volumeIndicator}%</span>
            </div>
          </div>
        )}

        {/* HW decode badge */}
        {Object.values(hwDecodeSupported).some((v) => v) && (
          <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/20 px-2 py-1 text-[10px] font-bold text-green-400 backdrop-blur-sm">
            <Zap size={10} /> HW
          </div>
        )}

        {/* Controls overlay */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity duration-300',
            controlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 20%, transparent 75%, rgba(0,0,0,0.85) 100%)',
          }}
        >
          {/* Top bar */}
          <div className="pointer-events-auto flex items-center justify-between px-4 pt-4">
            <div className="flex items-center gap-3">
              {onClose && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-white/20"
                      onClick={onClose}
                    >
                      <X size={18} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Close</TooltipContent>
                </Tooltip>
              )}
              <div>
                <h2 className="text-sm font-bold text-white drop-shadow-lg">
                  {currentFile?.title}
                </h2>
                {currentChapter && <p className="text-xs text-white/60">{currentChapter.title}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Playback speed */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full bg-black/40 px-3 text-xs font-bold text-white backdrop-blur-md hover:bg-white/20"
                  >
                    {playbackRate}×
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border-white/10 bg-zinc-900/95 text-white backdrop-blur-xl">
                  <DropdownMenuLabel className="text-xs text-zinc-400">Speed</DropdownMenuLabel>
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                    <DropdownMenuItem
                      key={r}
                      onClick={() => setPlaybackRate(r)}
                      className={cn(playbackRate === r && 'bg-purple-500/20 text-purple-300')}
                    >
                      {r}×
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Audio tracks */}
              {audioTracks.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-white/20"
                    >
                      <Headphones size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="border-white/10 bg-zinc-900/95 text-white backdrop-blur-xl">
                    <DropdownMenuLabel className="text-xs text-zinc-400">
                      Audio Tracks
                    </DropdownMenuLabel>
                    {audioTracks.map((track) => (
                      <DropdownMenuItem
                        key={track.stream_index}
                        onClick={() => switchAudioTrack(track.stream_index)}
                        className={cn(
                          selectedAudioTrack === track.stream_index && 'text-purple-300',
                        )}
                      >
                        {track.language || 'Unknown'} · {track.codec_name} ({track.channels}ch)
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Subtitles */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-white/20"
                  >
                    <Subtitles size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Subtitles</TooltipContent>
              </Tooltip>

              {/* Video settings */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-white/20"
                  >
                    <Settings size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-72 border-white/10 bg-zinc-900/95 p-4 text-white backdrop-blur-xl"
                  side="bottom"
                  align="end"
                >
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Aspect Ratio
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['fit', 'fill', '16:9', '4:3', 'stretch', 'anamorphic'].map((ratio) => (
                          <button
                            key={ratio}
                            className={cn(
                              'rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors',
                              aspectRatio === ratio
                                ? 'bg-purple-600 text-white'
                                : 'bg-white/10 text-white/70 hover:bg-white/20',
                            )}
                            onClick={() => setAspectRatio(ratio)}
                          >
                            {ratio.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <DropdownMenuSeparator className="border-white/10" />

                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Enhancements
                      </p>
                      {[
                        {
                          label: 'Brightness',
                          value: brightness,
                          set: setBrightness,
                          min: 0.5,
                          max: 2,
                        },
                        { label: 'Contrast', value: contrast, set: setContrast, min: 0.5, max: 2 },
                        {
                          label: 'Saturation',
                          value: saturation,
                          set: setSaturation,
                          min: 0,
                          max: 2,
                        },
                        { label: 'Hue', value: hue, set: setHue, min: -180, max: 180 },
                      ].map(({ label, value, set, min, max }) => (
                        <div key={label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400">{label}</span>
                            <span className="font-mono text-white">
                              {typeof value === 'number' && label === 'Hue'
                                ? `${value}°`
                                : value.toFixed(1)}
                            </span>
                          </div>
                          <Slider
                            value={[value]}
                            min={min}
                            max={max}
                            step={label === 'Hue' ? 1 : 0.1}
                            onValueChange={([v]) => set(v)}
                            className="h-1"
                          />
                        </div>
                      ))}
                    </div>

                    <DropdownMenuSeparator className="border-white/10" />

                    <div className="flex gap-2">
                      <button
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                        onClick={() => setRotation((r) => (r + 90) % 360)}
                      >
                        <RotateCcw size={12} /> Rotate
                      </button>
                      <button
                        className={cn(
                          'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                          mirrorFlip
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/10 text-white hover:bg-white/20',
                        )}
                        onClick={() => setMirrorFlip((f) => !f)}
                      >
                        <FlipHorizontal size={12} /> Mirror
                      </button>
                      <button
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                        onClick={() => {
                          setBrightness(1);
                          setContrast(1);
                          setSaturation(1);
                          setHue(0);
                          setRotation(0);
                          setMirrorFlip(false);
                        }}
                      >
                        <RotateCcw size={12} /> Reset
                      </button>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="pointer-events-auto space-y-2 px-4 pb-4">
            {/* Seek bar */}
            <div
              className="group/seek relative h-5 w-full cursor-pointer"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setHoverPercent(pct * 100);
                setHoverTime(pct * duration);
                setShowHoverTime(true);
              }}
              onMouseLeave={() => setShowHoverTime(false)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                handleSeek(pct * duration);
              }}
            >
              {/* Track */}
              <div className="absolute bottom-2 left-0 right-0 h-1 overflow-visible rounded-full bg-white/20 transition-all duration-100 group-hover/seek:h-1.5">
                {/* Buffer (mock) */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-white/30"
                  style={{ width: `${Math.min(100, progress + 10)}%` }}
                />
                {/* Progress */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-none"
                  style={{ width: `${progress}%` }}
                />
                {/* Chapter ticks */}
                {chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="absolute top-0 h-full w-0.5 bg-white/50"
                    style={{ left: `${(ch.start_time_ms / (duration * 1000)) * 100}%` }}
                    title={ch.title}
                  />
                ))}
                {/* Hover indicator */}
                {showHoverTime && (
                  <div
                    className="absolute top-0 h-full w-0.5 bg-white/50"
                    style={{ left: `${hoverPercent}%` }}
                  />
                )}
              </div>

              {/* Scrubber thumb */}
              <div
                className="pointer-events-none absolute bottom-1.5 h-3 w-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow-lg transition-all group-hover/seek:opacity-100"
                style={{ left: `${progress}%` }}
              />

              {/* Hover time tooltip */}
              {showHoverTime && duration > 0 && (
                <div
                  className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded bg-black/80 px-2 py-1 font-mono text-[10px] text-white backdrop-blur-sm"
                  style={{ left: `${hoverPercent}%` }}
                >
                  {formatDuration(hoverTime)}
                </div>
              )}
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {/* Prev chapter */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-white hover:bg-white/15"
                      onClick={prevChapter}
                      disabled={chapters.length === 0}
                    >
                      <SkipBack size={18} fill="currentColor" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous chapter</TooltipContent>
                </Tooltip>

                {/* Seek back 10s */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-white hover:bg-white/15"
                      onClick={() => {
                        const video = videoRef.current;
                        if (video) video.currentTime = Math.max(0, video.currentTime - 10);
                        showSkip('backward');
                      }}
                    >
                      <ChevronsLeft size={20} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>-10s</TooltipContent>
                </Tooltip>

                {/* Play/Pause */}
                <Button
                  size="icon"
                  className="h-12 w-12 rounded-full bg-white text-black shadow-2xl transition-transform hover:scale-105 hover:bg-white/90"
                  onClick={togglePlayback}
                >
                  {isPlaying ? (
                    <Pause size={22} fill="currentColor" />
                  ) : (
                    <Play size={22} fill="currentColor" className="ml-0.5" />
                  )}
                </Button>

                {/* Seek forward 10s */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-white hover:bg-white/15"
                      onClick={() => {
                        const video = videoRef.current;
                        if (video)
                          video.currentTime = Math.min(video.duration, video.currentTime + 10);
                        showSkip('forward');
                      }}
                    >
                      <ChevronsRight size={20} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>+10s</TooltipContent>
                </Tooltip>

                {/* Next chapter */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-white hover:bg-white/15"
                      onClick={nextChapter}
                      disabled={chapters.length === 0}
                    >
                      <SkipForward size={18} fill="currentColor" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next chapter</TooltipContent>
                </Tooltip>

                {/* Time display */}
                <span className="ml-2 font-mono text-xs text-white/80">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {/* Volume */}
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-white hover:bg-white/15"
                        onClick={toggleMute}
                      >
                        <VolumeIcon size={18} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle mute</TooltipContent>
                  </Tooltip>
                  <div className="w-24">
                    <Slider
                      value={[muted ? 0 : volume * 100]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([v]) => changeVolume(v / 100)}
                      className="h-1"
                    />
                  </div>
                </div>

                {/* Chapter list */}
                {chapters.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-9 w-9 rounded-full text-white hover:bg-white/15',
                          showChapterList && 'bg-purple-500/30 text-purple-300',
                        )}
                        onClick={() => setShowChapterList(!showChapterList)}
                      >
                        <List size={18} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Chapters</TooltipContent>
                  </Tooltip>
                )}

                {/* PiP */}
                {document.pictureInPictureEnabled && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-white hover:bg-white/15"
                        onClick={togglePiP}
                      >
                        <PictureInPicture size={18} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Picture-in-picture</TooltipContent>
                  </Tooltip>
                )}

                {/* Fullscreen */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-white hover:bg-white/15"
                      onClick={toggleFullscreen}
                    >
                      {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Chapter list sidebar */}
        {showChapterList && chapters.length > 0 && (
          <div className="absolute right-0 top-0 z-20 flex h-full w-72 flex-col overflow-y-auto border-l border-white/10 bg-black/80 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <List size={16} /> Chapters
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/60 hover:text-white"
                onClick={() => setShowChapterList(false)}
              >
                <X size={14} />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {chapters.map((c) => {
                const isActive =
                  currentTime * 1000 >= c.start_time_ms &&
                  (!c.end_time_ms || currentTime * 1000 < c.end_time_ms);
                return (
                  <button
                    key={c.id}
                    className={cn(
                      'mb-1 flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors',
                      isActive
                        ? 'bg-purple-500/25 text-purple-300'
                        : 'text-white/70 hover:bg-white/10',
                    )}
                    onClick={() => handleSeek(c.start_time_ms / 1000)}
                  >
                    <div
                      className={cn(
                        'h-1.5 w-1.5 flex-shrink-0 rounded-full',
                        isActive ? 'bg-purple-400' : 'bg-white/30',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">
                        {c.title || `Chapter ${c.chapter_index + 1}`}
                      </div>
                      <div className="font-mono text-[10px] opacity-50">
                        {formatDuration(c.start_time_ms / 1000)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default VideoPlayer;
