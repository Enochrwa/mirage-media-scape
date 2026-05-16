import React, { useState, useRef, useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronUp,
  Volume2,
  ListMusic,
  Zap,
} from 'lucide-react';
import { useLowPowerMode } from '@/hooks/useLowPowerMode';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, formatDuration } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const MiniPlayer: React.FC = () => {
  const [tooltipTime, setTooltipTime] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState(0);
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
  } = usePlayerStore();
  const { files } = useLibraryStore();
  const lowPowerMode = useLowPowerMode();

  if (!currentFile) return null;

  const handleProgressMouseMove = (e: React.MouseEvent) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    setTooltipTime(formatDuration(percent * duration));
    setTooltipPos(percent * 100);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 h-20 border-t border-border bg-background/80 px-4 backdrop-blur-lg">
      <div
        ref={progressRef}
        className="group absolute left-0 right-0 top-0 h-1 cursor-pointer"
        onMouseMove={handleProgressMouseMove}
        onMouseLeave={() => setTooltipTime(null)}
        onClick={(e) => {
          if (!progressRef.current) return;
          const rect = progressRef.current.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          usePlayerStore.getState().seekTo(percent * duration);
        }}
      >
        <Progress
          value={(currentTime / duration) * 100}
          className="h-1 rounded-none bg-primary/20"
        />
        {tooltipTime && (
          <div
            className="pointer-events-none absolute bottom-2 rounded border border-white/10 bg-black/90 px-2 py-0.5 text-[10px] text-white transition-all duration-75"
            style={{ left: `${tooltipPos}%`, transform: 'translateX(-50%)' }}
          >
            {tooltipTime}
          </div>
        )}
      </div>

      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4">
        <div
          className="group flex min-w-0 cursor-pointer items-center gap-3"
          onClick={() => setPlayerFullscreen(true)}
        >
          <img
            src={currentFile.cover || '/placeholder.svg'}
            alt={currentFile.title}
            className="h-12 w-12 rounded shadow-lg transition-transform group-hover:scale-105"
          />
          <div className="min-w-0 overflow-hidden">
            <h4 className="marquee-container whitespace-nowrap text-sm font-semibold leading-tight text-foreground">
              <span className={cn(currentFile.title.length > 30 && 'animate-marquee')}>
                {currentFile.title}
              </span>
            </h4>
            <p className="truncate text-xs text-muted-foreground">{currentFile.artist}</p>
          </div>
          <ChevronUp
            size={16}
            className="text-muted-foreground/50 transition-colors group-hover:text-foreground"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => previousTrack()}
            className="hidden sm:inline-flex"
          >
            <SkipBack size={20} />
          </Button>
          <Button
            size="icon"
            onClick={togglePlayback}
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
          >
            {isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" className="ml-1" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => nextTrack()}>
            <SkipForward size={20} />
          </Button>
        </div>

        <div className="flex items-center gap-4 text-muted-foreground">
          {lowPowerMode && (
            <div className="hidden items-center rounded-full bg-yellow-500/20 px-2 py-1 text-[10px] font-bold text-yellow-500 lg:flex">
              <Zap className="mr-1 h-3 w-3 fill-current" />
              LOW POWER
            </div>
          )}
          <Button variant="ghost" size="icon" className="hidden md:inline-flex">
            <Volume2 size={20} />
          </Button>
          <Button variant="ghost" size="icon" className="hidden md:inline-flex">
            <ListMusic size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
};
