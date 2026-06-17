import React, { useState, useRef } from 'react';
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
  } = usePlayerStore();
  const lowPowerMode = useLowPowerMode();

  if (!currentFile) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressMouseMove = (e: React.MouseEvent) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    setTooltipTime(formatDuration(percent * duration));
    setTooltipPos(percent * 100);
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
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/90 backdrop-blur-xl">
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="group relative h-1 w-full cursor-pointer transition-all hover:h-1.5"
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={() => setTooltipTime(null)}
          onClick={(e) => {
            if (!progressRef.current) return;
            const rect = progressRef.current.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            usePlayerStore.getState().seekTo(percent * duration);
          }}
        >
          {/* Track */}
          <div className="h-full bg-primary/20" />
          {/* Progress */}
          <div
            className="absolute top-0 h-full bg-gradient-to-r from-purple-500 to-violet-400 transition-none"
            style={{ width: `${progress}%` }}
          />
          {/* Thumb dot */}
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
            style={{ left: `${progress}%` }}
          />
          {tooltipTime && (
            <div
              className="pointer-events-none absolute bottom-3 rounded bg-black/80 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm"
              style={{ left: `${tooltipPos}%`, transform: 'translateX(-50%)' }}
            >
              {tooltipTime}
            </div>
          )}
        </div>

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4">
          {/* Track info */}
          <div
            className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3"
            onClick={() => setPlayerFullscreen(true)}
          >
            <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-md shadow-md">
              <img
                src={currentFile.cover || '/placeholder.svg'}
                alt={currentFile.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <h4 className="truncate text-sm font-semibold leading-tight text-foreground">
                  {currentFile.title}
                </h4>
                <ChevronUp
                  size={14}
                  className="flex-shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground"
                />
              </div>
              <p className="truncate text-xs text-muted-foreground">{currentFile.artist}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'hidden h-8 w-8 sm:inline-flex',
                    isFavorite && 'text-red-400 hover:text-red-300',
                  )}
                  onClick={() => setIsFavorite(!isFavorite)}
                >
                  <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Favorite</TooltipContent>
            </Tooltip>

            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 sm:inline-flex"
              onClick={() => previousTrack()}
            >
              <SkipBack size={18} fill="currentColor" />
            </Button>

            <Button
              size="icon"
              onClick={togglePlayback}
              className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 hover:bg-primary/90"
            >
              {isPlaying ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" className="ml-0.5" />
              )}
            </Button>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => nextTrack()}>
              <SkipForward size={18} fill="currentColor" />
            </Button>
          </div>

          {/* Right side */}
          <div className="hidden flex-shrink-0 items-center gap-2 md:flex">
            {lowPowerMode && (
              <div className="flex items-center rounded-full bg-yellow-500/20 px-2 py-1 text-[10px] font-bold text-yellow-500">
                <Zap className="mr-1 h-3 w-3 fill-current" />
                LOW POWER
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMute}>
                  <VolumeIcon size={16} />
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ListMusic size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Queue</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
