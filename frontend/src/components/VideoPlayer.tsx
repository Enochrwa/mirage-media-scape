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
  Heart,
  Share2,
  Settings,
  Zap,
  Eye,
  Palette,
  RotateCcw,
  FastForward,
  PictureInPicture,
  Download,
  Subtitles,
  Filter,
  Sparkles,
  Sun,
  Waves,
  Headphones,
  List,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { SubtitleCue } from '@/lib/utils';
import { usePlayerStore } from '@/store/usePlayerStore';
import SubtitleManager from './SubtitleManager';
import { VideoDecodeEngine } from '@/engines/VideoDecodeEngine';
import { client } from '@/api/client';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

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

const VideoPlayer: React.FC = () => {
  const {
    currentFile,
    setCurrentTime: updateStoreCurrentTime,
    setDuration: updateStoreDuration,
    playbackEngine: pe,
    isPlaying: storeIsPlaying,
  } = usePlayerStore();

  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(currentFile?.duration || 0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [hwDecodeSupported, setHwDecodeSupported] = useState<Record<string, boolean>>({});
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showChapterList, setShowChapterList] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hoverThumb, setHoverThumb] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState(0);

  // Persistent visual settings
  const [aspectRatio, setAspectRatio] = useState('fit');
  const [rotation, setRotation] = useState(0);
  const [mirrorFlip, setMirrorFlip] = useState(false);
  const [brightness, setBrightness] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  const [hue, setHue] = useState(0);

  // Mobile gesture state
  const [scale, setScale] = useState(1.0);
  const [pinchStartScale, setPinchStartScale] = useState(1.0);
  const [isPinching, setIsPinching] = useState(false);
  const [useFallbackPiP, setUseFallbackPiP] = useState(false);

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

    const onEnded = () => {
      usePlayerStore.getState().nextTrack();
    };

    const onCanPlay = () => {
      // Only auto-play if the store says we should be playing
      if (usePlayerStore.getState().isPlaying) {
        video.play().catch((err) => {
          console.warn('[VideoPlayer] Autoplay blocked:', err);
        });
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

  // Sync play/pause state from store to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentFile) return;
    if (storeIsPlaying) {
      // Only call play() if video has enough data; canplay handler covers the loading case
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        video.play().catch(console.error);
      }
    } else {
      video.pause();
    }
  }, [storeIsPlaying, currentFile]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    VideoDecodeEngine.probeHardwareDecode().then(setHwDecodeSupported);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) setControlsVisible(false);
      }, 2000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimeout]);

  // Load per-file settings
  const { autoPiP } = usePlayerStore();

  useEffect(() => {
    const handlePopState = () => {
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

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Also handle navigation via React Router by checking location change
      handlePopState();
    };
  }, [location.pathname, isPlaying, hasInteracted, autoPiP]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleError = async () => {
      if (!currentFile) return;
      const src = video.src;
      if (!src.includes('transcode=1')) {
        console.warn('[VideoPlayer] Native playback failed, switching to transcode mode');
        video.src = `${API_BASE}/api/stream/${currentFile.id}?transcode=1`;
        video.load();
        video.play().catch(console.error);
      }
    };

    video.addEventListener('error', handleError);
    return () => video.removeEventListener('error', handleError);
  }, [currentFile]);

  useEffect(() => {
    if (currentFile?.id) {
      client.get(`/api/tracks/${currentFile.id}`).then((res) => {
        if (res.aspect_ratio_override) setAspectRatio(res.aspect_ratio_override);
        if (res.rotation_degrees) setRotation(res.rotation_degrees);
        if (res.mirror_flip) setMirrorFlip(!!res.mirror_flip);
      });
      client.get(`/api/tracks/${currentFile.id}/audio-streams`).then(setAudioTracks);
      client.get(`/api/tracks/${currentFile.id}/chapters`).then(setChapters);
    }
  }, [currentFile?.id]);

  // Handle Playback
  const togglePlayback = () => {
    setHasInteracted(true);
    usePlayerStore.getState().togglePlayback();
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
  };

  const toggleFullscreen = async () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      await videoContainerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      } else {
        // Fallback to CSS PiP
        setUseFallbackPiP(!useFallbackPiP);
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  };

  // Mobile Gestures
  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container) return;

    let startX = 0;
    let startY = 0;
    let initialTime = 0;
    let initialBrightness = brightness;
    let initialVolume = volume;

    const onTouchStart = (e: TouchEvent) => {
      resetControlsTimeout();
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        initialTime = currentTime;
        initialBrightness = brightness;
        initialVolume = volume;
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

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && !isPinching) {
        const deltaX = e.touches[0].clientX - startX;
        const deltaY = e.touches[0].clientY - startY;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
          // Seek
          const seekDelta = (deltaX / container.clientWidth) * 90;
          const newTime = Math.max(0, Math.min(duration, initialTime + seekDelta));
          setCurrentTime(newTime);
        } else if (Math.abs(deltaY) > 30) {
          // Brightness / Volume
          const isLeft = startX < container.clientWidth / 2;
          const delta = -(deltaY / container.clientHeight);
          if (isLeft) {
            setBrightness(Math.max(0.5, Math.min(2.0, initialBrightness + delta)));
          } else {
            const newVol = Math.max(0, Math.min(1, initialVolume + delta));
            setVolume(newVol);
            pe.setVolume(newVol);
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

    const onTouchEnd = (e: TouchEvent) => {
      if (!isPinching && Math.abs(e.changedTouches[0].clientX - startX) > 30) {
        if (videoRef.current) videoRef.current.currentTime = currentTime;
      }
      if (scale < 1.05) setScale(1.0);
    };

    container.addEventListener('touchstart', onTouchStart);
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [
    brightness,
    volume,
    currentTime,
    duration,
    isPinching,
    pinchStartScale,
    scale,
    resetControlsTimeout,
    pe,
  ]);

  // Audio track switching
  const switchAudioTrack = async (index: number) => {
    if (!currentFile || !videoRef.current) return;
    const time = videoRef.current.currentTime;
    setSelectedAudioTrack(index);
    const url = new URL(currentFile.file || '', window.location.origin);
    url.searchParams.set('audio_stream', index.toString());

    const onLoadedMetadata = () => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        if (isPlaying) videoRef.current.play();
      }
      videoRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
    };

    videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
    videoRef.current.src = url.toString();
    videoRef.current.load();
  };

  // Chapter navigation
  const nextChapter = () => {
    const next = chapters.find((c) => c.start_time_ms > currentTime * 1000 + 500);
    if (next) handleSeek(next.start_time_ms / 1000);
  };
  const prevChapter = () => {
    // Find current chapter
    const curIdx = [...chapters]
      .reverse()
      .findIndex((c) => c.start_time_ms <= currentTime * 1000 + 10);
    const actualIdx = curIdx === -1 ? -1 : chapters.length - 1 - curIdx;

    if (actualIdx !== -1) {
      const cur = chapters[actualIdx];
      // If we are more than 2 seconds into the current chapter, restart it
      if (currentTime * 1000 > cur.start_time_ms + 2000) {
        handleSeek(cur.start_time_ms / 1000);
      } else {
        // Otherwise, go to the previous chapter start
        if (actualIdx > 0) {
          handleSeek(chapters[actualIdx - 1].start_time_ms / 1000);
        } else {
          // If first chapter and within 2s, just restart it
          handleSeek(0);
        }
      }
    } else {
      // Not in any chapter (before first), restart
      handleSeek(0);
    }
  };

  // Video effects processing
  const videoFilter = useMemo(() => {
    return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hue}deg)`;
  }, [brightness, contrast, saturation, hue]);

  return (
    <div
      className={cn(
        'relative flex w-full flex-col overflow-hidden bg-black',
        useFallbackPiP
          ? 'fixed bottom-4 right-4 z-[9999] aspect-video w-[280px] rounded-lg border border-white/20 shadow-2xl animate-in slide-in-from-bottom-4'
          : 'h-screen',
      )}
    >
      {useFallbackPiP && (
        <button
          onClick={() => setUseFallbackPiP(false)}
          className="absolute right-2 top-2 z-[10000] rounded-full bg-black/50 p-1 text-white hover:bg-black/80"
        >
          <X size={14} />
        </button>
      )}
      {/* Container with auto-hide controls */}
      <div
        ref={videoContainerRef}
        className="group relative flex-1"
        onMouseMove={resetControlsTimeout}
        onDoubleClick={toggleFullscreen}
      >
        {/* Video wrapper for transforms */}
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            willChange: 'transform',
            transform: `rotate(${rotation}deg) scaleX(${mirrorFlip ? -1 : 1}) scale(${scale})`,
          }}
        >
          <video
            ref={videoRef}
            src={currentFile?.file}
            className={cn(
              'max-h-full max-w-full',
              aspectRatio === 'fill'
                ? 'h-full w-full object-fill'
                : aspectRatio === 'stretch'
                  ? 'h-full w-full object-fill'
                  : 'object-contain',
            )}
            style={{ filter: videoFilter }}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              setCurrentTime(t);
              updateStoreCurrentTime(t);
            }}
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              setDuration(d);
              updateStoreDuration(d);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        </div>

        {/* Subtitles Overlay */}
        <SubtitleManager />

        {/* Floating Controls Overlay */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex flex-col justify-between p-4 transition-opacity duration-300',
            controlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0',
          )}
        >
          {/* Top Bar */}
          <div className="pointer-events-auto flex items-start justify-between">
            <div className="max-w-md rounded-xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
              <h2 className="truncate font-bold text-white">{currentFile?.title}</h2>
              <p className="truncate text-sm text-white/60">{currentFile?.artist}</p>
              {Object.values(hwDecodeSupported).some((v) => v) && (
                <div className="mt-2 inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/20 px-1.5 py-0.5 text-[10px] font-bold text-green-400">
                  <Zap size={10} /> HW
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="bg-black/50 text-white backdrop-blur-md hover:bg-white/10"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft />
              </Button>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pointer-events-auto space-y-4">
            {/* Seek Bar with Chapter marks */}
            <div className="group/seekbar relative px-4">
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="absolute left-0 top-0 h-full bg-purple-500"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
                {/* Chapter Ticks */}
                {chapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    className="absolute top-0 h-full w-0.5 bg-white/40"
                    style={{ left: `${(chapter.start_time_ms / (duration * 1000)) * 100}%` }}
                    title={chapter.title}
                  />
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  setHoverTime(percent * duration);
                  if (currentFile?.id) {
                    setHoverThumb(
                      `${API_BASE}/api/tracks/${currentFile.id}/thumbnail-at?at=${Math.floor(percent * duration)}`,
                    );
                  }
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />

              {/* Hover Thumb */}
              <div
                className="pointer-events-none absolute bottom-full mb-2 hidden -translate-x-1/2 group-hover/seekbar:block"
                style={{ left: `${(hoverTime / duration) * 100}%` }}
              >
                <div className="rounded border border-white/20 bg-zinc-900 p-1 shadow-xl">
                  <img src={hoverThumb || ''} className="aspect-video w-40 rounded object-cover" />
                  <div className="mt-1 text-center font-mono text-[10px] text-white">
                    {formatDuration(hoverTime)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/50 p-4 backdrop-blur-xl">
              <div className="flex items-center gap-4 text-white">
                <button
                  onClick={prevChapter}
                  disabled={chapters.length === 0}
                  className="disabled:opacity-30"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={togglePlayback}
                  className="rounded-full bg-white p-3 text-black transition hover:scale-105"
                >
                  {isPlaying ? <Pause /> : <Play fill="currentColor" />}
                </button>
                <button
                  onClick={nextChapter}
                  disabled={chapters.length === 0}
                  className="disabled:opacity-30"
                >
                  <ChevronRight size={20} />
                </button>
                <div className="font-mono text-sm">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                      <Headphones size={20} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="border-white/10 bg-zinc-900 text-white">
                    {audioTracks.map((track) => (
                      <DropdownMenuItem
                        key={track.stream_index}
                        onClick={() => switchAudioTrack(track.stream_index)}
                      >
                        {track.language || 'Unknown'} - {track.codec_name} ({track.channels}ch)
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'text-white hover:bg-white/10',
                    showChapterList && 'text-purple-400',
                  )}
                  onClick={() => setShowChapterList(!showChapterList)}
                >
                  <List size={20} />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                      <Settings size={20} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 space-y-4 border-white/10 bg-zinc-900 p-4 text-white">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase text-zinc-500">
                        Aspect Ratio
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['fit', 'fill', '16:9', '4:3', 'stretch', 'anamorphic'].map((ratio) => (
                          <Button
                            key={ratio}
                            variant="outline"
                            size="sm"
                            className={cn(
                              'h-7 border-white/10 text-[10px]',
                              aspectRatio === ratio && 'border-purple-500 bg-purple-500',
                            )}
                            onClick={() => setAspectRatio(ratio)}
                          >
                            {ratio.toUpperCase()}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-xs font-semibold uppercase text-zinc-500">
                        Enhancements
                      </label>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="opacity-60">Brightness</span>{' '}
                            <span>{brightness.toFixed(1)}</span>
                          </div>
                          <Slider
                            value={[brightness]}
                            min={0.5}
                            max={2.0}
                            step={0.1}
                            onValueChange={([v]) => setBrightness(v)}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="opacity-60">Contrast</span>{' '}
                            <span>{contrast.toFixed(1)}</span>
                          </div>
                          <Slider
                            value={[contrast]}
                            min={0.5}
                            max={2.0}
                            step={0.1}
                            onValueChange={([v]) => setContrast(v)}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="opacity-60">Saturation</span>{' '}
                            <span>{saturation.toFixed(1)}</span>
                          </div>
                          <Slider
                            value={[saturation]}
                            min={0.0}
                            max={2.0}
                            step={0.1}
                            onValueChange={([v]) => setSaturation(v)}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="opacity-60">Hue</span> <span>{hue}°</span>
                          </div>
                          <Slider
                            value={[hue]}
                            min={-180}
                            max={180}
                            step={1}
                            onValueChange={([v]) => setHue(v)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between border-t border-white/10 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={() => setRotation((rotation + 90) % 360)}
                      >
                        Rotate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn('h-7 text-[10px]', mirrorFlip && 'text-purple-400')}
                        onClick={() => setMirrorFlip(!mirrorFlip)}
                      >
                        Mirror
                      </Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={togglePiP}
                >
                  <PictureInPicture size={20} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chapter List Sidebar */}
      {showChapterList && (
        <div className="flex w-80 flex-col gap-2 overflow-y-auto border-l border-white/10 bg-zinc-900 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-white">
            <List size={18} /> Chapters
          </h3>
          {chapters.map((c) => (
            <button
              key={c.id}
              className={cn(
                'rounded-lg p-3 text-left transition',
                currentTime * 1000 >= c.start_time_ms &&
                  (!c.end_time_ms || currentTime * 1000 < c.end_time_ms)
                  ? 'border border-purple-500/30 bg-purple-500/20 text-purple-400'
                  : 'bg-white/5 text-white/70 hover:bg-white/10',
              )}
              onClick={() => handleSeek(c.start_time_ms / 1000)}
            >
              <div className="text-xs opacity-60">Chapter {c.chapter_index + 1}</div>
              <div className="truncate font-medium">{c.title || 'Untitled'}</div>
              <div className="font-mono text-[10px] opacity-40">
                {formatDuration(c.start_time_ms / 1000)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
