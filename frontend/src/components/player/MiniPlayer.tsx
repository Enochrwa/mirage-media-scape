import React, { useState, useRef, useCallback } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronUp,
  Volume2,
  VolumeX,
  Volume1,
  ListMusic,
  Zap,
  Heart,
  X,
  Repeat,
  Shuffle,
  Radio,
} from 'lucide-react';
import { useLowPowerMode } from '@/hooks/useLowPowerMode';
import { Button } from '@/components/ui/button';
import { cn, formatDuration } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';

export const MiniPlayer: React.FC = () => {
  const [tooltipTime, setTooltipTime] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [isDragging, setIsDragging] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const {
    currentFile,
    isPlaying,
    togglePlayback,
    currentTime,
    duration,
    nextTrack,
    previousTrack,
    setPlayerFullscreen,
    volume,
    setVolume,
    closePlayer,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
  } = usePlayerStore();
  const lowPowerMode = useLowPowerMode();

  if (!currentFile) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressMouseMove = (e: React.MouseEvent) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    setTooltipTime(formatDuration(percent * duration));
    setTooltipPos(percent * 100);
  };

  const handleSeekClick = (e: React.MouseEvent) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    usePlayerStore.getState().seekTo(percent * duration);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(prevVolume || 0.8);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      setVolume(0);
    }
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="bg-background/92 fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 backdrop-blur-2xl">
        {/* ── Seek bar ── */}
        <div
          ref={progressRef}
          className="group relative h-1 w-full cursor-pointer transition-all hover:h-[5px]"
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={() => setTooltipTime(null)}
          onClick={handleSeekClick}
        >
          {/* Track */}
          <div className="h-full bg-primary/15" />
          {/* Progress */}
          <div
            className="absolute top-0 h-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-none"
            style={{ width: `${progress}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
            style={{ left: `${progress}%` }}
          />
          {/* Hover tooltip */}
          {tooltipTime && (
            <div
              className="pointer-events-none absolute bottom-3 rounded-md bg-zinc-900/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-xl ring-1 ring-white/10 backdrop-blur-sm"
              style={{ left: `${tooltipPos}%`, transform: 'translateX(-50%)' }}
            >
              {tooltipTime}
            </div>
          )}
        </div>

        {/* ── Main bar ── */}
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-2 px-3 md:px-5">
          {/* Track info */}
          <div
            className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3"
            onClick={() => setPlayerFullscreen(true)}
          >
            <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg shadow-md ring-1 ring-white/10">
              <img
                src={currentFile.cover || '/placeholder.svg'}
                alt={currentFile.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {/* Playing pulse ring */}
              {isPlaying && (
                <div className="pointer-events-none absolute inset-0 animate-pulse rounded-lg ring-2 ring-purple-500/60 ring-offset-0" />
              )}
            </div>
            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <h4 className="truncate text-sm font-semibold leading-tight text-foreground">
                  {currentFile.title}
                </h4>
                <ChevronUp
                  size={13}
                  className="flex-shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground"
                />
              </div>
              <p className="truncate text-xs text-muted-foreground/70">
                {currentFile.artist || currentFile.album}
              </p>
            </div>
          </div>

          {/* ── Centre controls ── */}
          <div className="flex items-center gap-0.5">
            {/* Shuffle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'hidden h-8 w-8 sm:inline-flex',
                    shuffle
                      ? 'text-purple-400 hover:text-purple-300'
                      : 'text-muted-foreground/60 hover:text-foreground',
                  )}
                  onClick={() => setShuffle(!shuffle)}
                >
                  <Shuffle size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Shuffle {shuffle ? 'On' : 'Off'}</TooltipContent>
            </Tooltip>

            {/* Favorite */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'hidden h-8 w-8 sm:inline-flex',
                    isFavorite
                      ? 'text-red-400 hover:text-red-300'
                      : 'text-muted-foreground/60 hover:text-foreground',
                  )}
                  onClick={() => setIsFavorite(!isFavorite)}
                >
                  <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFavorite ? 'Unfavorite' : 'Favorite'}</TooltipContent>
            </Tooltip>

            {/* Prev */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 text-foreground/80 hover:text-foreground sm:inline-flex"
              onClick={() => previousTrack()}
            >
              <SkipBack size={17} fill="currentColor" />
            </Button>

            {/* Play/Pause */}
            <Button
              size="icon"
              onClick={togglePlayback}
              className="h-[42px] w-[42px] rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-105 hover:bg-primary/90 active:scale-95"
            >
              {isPlaying ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" className="ml-0.5" />
              )}
            </Button>

            {/* Next */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-foreground/80 hover:text-foreground"
              onClick={() => nextTrack()}
            >
              <SkipForward size={17} fill="currentColor" />
            </Button>

            {/* Repeat */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'hidden h-8 w-8 sm:inline-flex',
                    repeat
                      ? 'text-purple-400 hover:text-purple-300'
                      : 'text-muted-foreground/60 hover:text-foreground',
                  )}
                  onClick={() => setRepeat(!repeat)}
                >
                  <Repeat size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Repeat {repeat ? 'On' : 'Off'}</TooltipContent>
            </Tooltip>
          </div>

          {/* ── Right side ── */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 md:gap-2">
            {lowPowerMode && (
              <div className="hidden items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-[9px] font-bold text-yellow-500 md:flex">
                <Zap className="mr-1 h-3 w-3 fill-current" />
                LOW POWER
              </div>
            )}

            {/* Volume */}
            <div className="hidden items-center gap-1.5 md:flex">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground/70 hover:text-foreground"
                    onClick={toggleMute}
                  >
                    <VolumeIcon size={15} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle mute</TooltipContent>
              </Tooltip>
              <div className="w-20">
                <Slider
                  value={[isMuted ? 0 : volume * 100]}
                  max={100}
                  step={1}
                  onValueChange={(v) => {
                    setVolume(v[0] / 100);
                    if (v[0] > 0) setIsMuted(false);
                  }}
                  className="h-1"
                />
              </div>
            </div>

            {/* Queue */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden h-8 w-8 text-muted-foreground/70 hover:text-foreground md:inline-flex"
                >
                  <ListMusic size={15} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Queue</TooltipContent>
            </Tooltip>

            {/* ✅ Close / dismiss player */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground/50 hover:text-foreground"
                  onClick={closePlayer}
                >
                  <X size={15} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close player</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
