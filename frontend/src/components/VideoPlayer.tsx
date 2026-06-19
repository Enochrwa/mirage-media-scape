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
  X,
  Headphones,
  RotateCcw,
  FlipHorizontal,
  ChevronsLeft,
  ChevronsRight,
  Gauge,
  Download,
  Cast,
  ChevronLeft,
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
    isPlaying: storeIsPlaying,
  } = usePlayerStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const [skipIndicator, setSkipIndicator] = useState<{
    dir: 'forward' | 'backward';
    secs: number;
  } | null>(null);
  const [volumeIndicator, setVolumeIndicator] = useState<number | null>(null);
  const [buffered, setBuffered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

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

    setIsLoading(true);
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
      // Update buffered range
      if (video.buffered.length > 0 && video.duration > 0) {
        setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
      }
    };
    const onEnded = () => usePlayerStore.getState().nextTrack();
    const onCanPlay = () => {
      setIsLoading(false);
      if (usePlayerStore.getState().isPlaying) {
        video.play().catch((err) => console.warn('[VideoPlayer] Autoplay blocked:', err));
      }
    };
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('canplay', onCanPlay, { once: true });
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      // ✅ CRITICAL: pause video when component unmounts (navigating away)
      video.pause();
      video.src = '';
      video.load();
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
          {
            const secs = e.shiftKey ? 30 : 10;
            video.currentTime = Math.min(video.duration, video.currentTime + secs);
            showSkipIndicator('forward', secs);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          {
            const secs = e.shiftKey ? 30 : 10;
            video.currentTime = Math.max(0, video.currentTime - secs);
            showSkipIndicator('backward', secs);
          }
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
        case 'j':
          video.currentTime = Math.max(0, video.currentTime - 10);
          showSkipIndicator('backward', 10);
          break;
        case 'l':
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          showSkipIndicator('forward', 10);
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, isFullscreen]);

  const showSkipIndicator = (dir: 'forward' | 'backward', secs: number) => {
    setSkipIndicator({ dir, secs });
    setTimeout(() => setSkipIndicator(null), 700);
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

  const togglePlayback = () => usePlayerStore.getState().togglePlayback();

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

  const handleClose = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.src = '';
      video.load();
    }
    usePlayerStore.getState().pausePlayback();
    onClose?.();
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={videoContainerRef}
        className="group relative flex h-full w-full select-none overflow-hidden bg-black"
        onMouseMove={resetControlsTimeout}
        onDoubleClick={toggleFullscreen}
        onClick={(e) => {
          // Only toggle if clicking the container itself, not controls
          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO') {
            if (!showChapterList) togglePlayback();
          }
        }}
      >
        {/* Video element — fills full container */}
        <video
          ref={videoRef}
          className={cn(
            'absolute inset-0 h-full w-full',
            aspectRatio === 'fill' || aspectRatio === 'stretch'
              ? 'object-fill'
              : aspectRatio === '16:9'
                ? 'object-contain'
                : aspectRatio === '4:3'
                  ? 'object-contain'
                  : 'object-contain',
          )}
          style={{
            filter: videoFilter,
            transform: `rotate(${rotation}deg) scaleX(${mirrorFlip ? -1 : 1}) scale(${scale})`,
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
        />

        {/* Subtitles */}
        <SubtitleManager />

        {/* Loading spinner */}
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-14 w-14 animate-spin rounded-full border-[3px] border-white/20 border-t-white/80" />
          </div>
        )}

        {/* Skip indicators — YouTube-style ripple */}
        {skipIndicator?.dir === 'backward' && (
          <div className="pointer-events-none absolute left-[20%] top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="flex animate-[ping_0.5s_ease-out_1] flex-col items-center gap-2 rounded-2xl bg-white/20 px-8 py-5 backdrop-blur-md">
              <ChevronsLeft size={44} className="text-white" />
              <span className="text-sm font-bold text-white">{skipIndicator.secs}s</span>
            </div>
          </div>
        )}
        {skipIndicator?.dir === 'forward' && (
          <div className="pointer-events-none absolute right-[20%] top-1/2 -translate-y-1/2 translate-x-1/2">
            <div className="flex animate-[ping_0.5s_ease-out_1] flex-col items-center gap-2 rounded-2xl bg-white/20 px-8 py-5 backdrop-blur-md">
              <ChevronsRight size={44} className="text-white" />
              <span className="text-sm font-bold text-white">{skipIndicator.secs}s</span>
            </div>
          </div>
        )}

        {/* Volume OSD */}
        {volumeIndicator !== null && (
          <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 animate-in fade-in">
            <div className="flex items-center gap-2 rounded-full bg-black/70 px-5 py-2.5 ring-1 ring-white/10 backdrop-blur-md">
              <VolumeIcon size={16} className="text-white" />
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${volumeIndicator}%` }}
                />
              </div>
              <span className="min-w-[2.5rem] text-right text-sm font-bold text-white">
                {volumeIndicator}%
              </span>
            </div>
          </div>
        )}

        {/* HW decode badge */}
        {Object.values(hwDecodeSupported).some((v) => v) && (
          <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded-md border border-green-500/30 bg-green-500/15 px-2 py-1 text-[10px] font-bold text-green-400 backdrop-blur-sm">
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
              'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, transparent 18%, transparent 70%, rgba(0,0,0,0.9) 100%)',
          }}
        >
          {/* ───────────────── TOP BAR ───────────────── */}
          <div className="pointer-events-auto flex items-center justify-between px-5 pt-4 md:px-6">
            <div className="flex items-center gap-3">
              {/* Back / Close */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-white/20 active:scale-95"
                    onClick={handleClose}
                  >
                    <ChevronLeft size={20} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Back</TooltipContent>
              </Tooltip>

              <div className="min-w-0">
                <h2 className="max-w-xs truncate text-sm font-bold text-white drop-shadow-lg md:max-w-sm">
                  {currentFile?.title}
                </h2>
                {currentChapter && (
                  <p className="truncate text-xs text-white/55">{currentChapter.title}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Speed */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full bg-black/40 px-3 text-xs font-bold text-white backdrop-blur-md hover:bg-white/20"
                  >
                    <Gauge size={13} className="mr-1" />
                    {playbackRate}×
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border-white/10 bg-zinc-900/95 text-white backdrop-blur-xl">
                  <DropdownMenuLabel className="text-xs text-zinc-400">
                    Playback Speed
                  </DropdownMenuLabel>
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                    <DropdownMenuItem
                      key={r}
                      onClick={() => setPlaybackRate(r)}
                      className={cn(playbackRate === r && 'bg-purple-500/20 text-purple-300')}
                    >
                      {r === 1 ? 'Normal' : `${r}×`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Audio tracks */}
              {audioTracks.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-white/20"
                    >
                      <Headphones size={15} />
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
                        {track.language || 'Track'} · {track.codec_name} ({track.channels}ch)
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
                    <Subtitles size={15} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Subtitles / CC</TooltipContent>
              </Tooltip>

              {/* Video settings */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-white/20"
                  >
                    <Settings size={15} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-76 border-white/10 bg-zinc-900/95 p-4 text-white backdrop-blur-xl"
                  side="bottom"
                  align="end"
                >
                  <div className="space-y-4">
                    {/* Aspect ratio */}
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
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

                    {/* Color controls */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Picture Adjustments
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
                              {label === 'Hue' ? `${value}°` : value.toFixed(1)}
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

                    {/* Transform */}
                    <div className="flex gap-2">
                      <button
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20"
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
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                        onClick={() => {
                          setBrightness(1);
                          setContrast(1);
                          setSaturation(1);
                          setHue(0);
                          setRotation(0);
                          setMirrorFlip(false);
                          setScale(1);
                        }}
                      >
                        <RotateCcw size={12} /> Reset
                      </button>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Download */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`${API_BASE}/api/stream/${encodeURIComponent(currentFile?.id ?? '')}`}
                    download={currentFile?.title}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-white/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download size={15} />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* ───────────────── BOTTOM CONTROLS ───────────────── */}
          <div className="pointer-events-auto space-y-3 px-4 pb-5 md:px-6 md:pb-6">
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
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                handleSeek(pct * duration);
              }}
            >
              {/* Track */}
              <div className="absolute bottom-2 left-0 right-0 h-[3px] overflow-visible rounded-full bg-white/20 transition-all group-hover/seek:h-[5px]">
                {/* Buffered */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-white/25"
                  style={{ width: `${buffered}%` }}
                />
                {/* Progress */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-400 transition-none"
                  style={{ width: `${progress}%` }}
                />
                {/* Chapter ticks */}
                {chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="absolute top-0 h-full w-0.5 bg-white/60"
                    style={{ left: `${(ch.start_time_ms / (duration * 1000)) * 100}%` }}
                    title={ch.title}
                  />
                ))}
                {/* Hover ghost */}
                {showHoverTime && (
                  <div
                    className="absolute top-0 h-full w-px bg-white/50"
                    style={{ left: `${hoverPercent}%` }}
                  />
                )}
              </div>

              {/* Scrubber thumb */}
              <div
                className="pointer-events-none absolute bottom-1.5 h-4 w-4 -translate-x-1/2 rounded-full bg-white opacity-0 shadow-lg shadow-purple-500/40 transition-all group-hover/seek:scale-110 group-hover/seek:opacity-100"
                style={{ left: `${progress}%` }}
              />

              {/* Hover time tooltip */}
              {showHoverTime && duration > 0 && (
                <div
                  className="pointer-events-none absolute -top-9 -translate-x-1/2 rounded-md bg-zinc-900/90 px-2.5 py-1 font-mono text-[11px] font-semibold text-white shadow-xl ring-1 ring-white/10 backdrop-blur-sm"
                  style={{ left: `${hoverPercent}%` }}
                >
                  {formatDuration(hoverTime)}
                </div>
              )}
            </div>

            {/* Control row */}
            <div className="flex items-center justify-between gap-2">
              {/* Left cluster */}
              <div className="flex items-center gap-0.5 md:gap-1">
                {/* Prev chapter / prev track */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-white hover:bg-white/15 active:scale-95"
                      onClick={prevChapter}
                    >
                      <SkipBack size={18} fill="currentColor" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous</TooltipContent>
                </Tooltip>

                {/* -10s */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-white hover:bg-white/15 active:scale-95"
                      onClick={(e) => {
                        e.stopPropagation();
                        const v = videoRef.current;
                        if (v) {
                          v.currentTime = Math.max(0, v.currentTime - 10);
                          showSkipIndicator('backward', 10);
                        }
                      }}
                    >
                      <ChevronsLeft size={20} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>-10s</TooltipContent>
                </Tooltip>

                {/* Play/Pause — large */}
                <Button
                  size="icon"
                  className="h-13 w-13 mx-1 h-[52px] w-[52px] rounded-full bg-white text-black shadow-2xl shadow-white/20 transition-all hover:scale-105 hover:bg-white/90 active:scale-95"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayback();
                  }}
                >
                  {isPlaying ? (
                    <Pause size={24} fill="currentColor" />
                  ) : (
                    <Play size={24} fill="currentColor" className="ml-0.5" />
                  )}
                </Button>

                {/* +10s */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-white hover:bg-white/15 active:scale-95"
                      onClick={(e) => {
                        e.stopPropagation();
                        const v = videoRef.current;
                        if (v) {
                          v.currentTime = Math.min(v.duration, v.currentTime + 10);
                          showSkipIndicator('forward', 10);
                        }
                      }}
                    >
                      <ChevronsRight size={20} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>+10s</TooltipContent>
                </Tooltip>

                {/* Next chapter / next track */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-white hover:bg-white/15 active:scale-95"
                      onClick={nextChapter}
                    >
                      <SkipForward size={18} fill="currentColor" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next</TooltipContent>
                </Tooltip>

                {/* Time */}
                <span className="ml-2 hidden whitespace-nowrap font-mono text-xs text-white/70 sm:inline">
                  {formatDuration(currentTime)} <span className="text-white/30">/</span>{' '}
                  {formatDuration(duration)}
                </span>
              </div>

              {/* Right cluster */}
              <div className="flex items-center gap-0.5 md:gap-1">
                {/* Volume */}
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-white hover:bg-white/15"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMute();
                        }}
                      >
                        <VolumeIcon size={17} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle mute (M)</TooltipContent>
                  </Tooltip>
                  <div className="hidden w-20 sm:block" onClick={(e) => e.stopPropagation()}>
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

                {/* Chapters */}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowChapterList(!showChapterList);
                        }}
                      >
                        <List size={17} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Chapters</TooltipContent>
                  </Tooltip>
                )}

                {/* Cast / AirPlay */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-white hover:bg-white/15"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Cast size={17} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cast to TV</TooltipContent>
                </Tooltip>

                {/* PiP */}
                {document.pictureInPictureEnabled && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-white hover:bg-white/15"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePiP();
                        }}
                      >
                        <PictureInPicture size={17} />
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
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFullscreen();
                      }}
                    >
                      {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Chapter list sidebar */}
        {showChapterList && chapters.length > 0 && (
          <div className="absolute right-0 top-0 z-20 flex h-full w-72 flex-col overflow-y-auto border-l border-white/10 bg-black/85 backdrop-blur-xl">
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
