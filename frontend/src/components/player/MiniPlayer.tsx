import React, { useState, useRef, useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { Play, Pause, SkipBack, SkipForward, ChevronUp, Volume2, ListMusic, Zap } from 'lucide-react';
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
    setPlayerFullscreen
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
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-t border-border h-20 px-4">
      <div
        ref={progressRef}
        className="absolute top-0 left-0 right-0 h-1 group cursor-pointer"
        onMouseMove={handleProgressMouseMove}
        onMouseLeave={() => setTooltipTime(null)}
      >
        <Progress value={(currentTime / duration) * 100} className="h-1 rounded-none bg-primary/20" />
        {tooltipTime && (
          <div
            className="absolute bottom-2 bg-black/90 text-white text-[10px] px-2 py-0.5 rounded border border-white/10 pointer-events-none transition-all duration-75"
            style={{ left: `${tooltipPos}%`, transform: 'translateX(-50%)' }}
          >
            {tooltipTime}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between h-full max-w-7xl mx-auto gap-4">
        <div
          className="flex items-center gap-3 min-w-0 cursor-pointer group"
          onClick={() => setPlayerFullscreen(true)}
        >
          <img
            src={currentFile.cover || '/placeholder.svg'}
            alt={currentFile.title}
            className="h-12 w-12 rounded shadow-lg transition-transform group-hover:scale-105"
          />
          <div className="min-w-0 overflow-hidden">
            <h4 className="text-sm font-semibold whitespace-nowrap text-foreground leading-tight marquee-container">
              <span className={cn(currentFile.title.length > 30 && "animate-marquee")}>
                {currentFile.title}
              </span>
            </h4>
            <p className="text-xs text-muted-foreground truncate">
              {currentFile.artist}
            </p>
          </div>
          <ChevronUp size={16} className="text-muted-foreground/50 group-hover:text-foreground transition-colors" />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => previousTrack()} className="hidden sm:inline-flex">
            <SkipBack size={20} />
          </Button>
          <Button
            size="icon"
            onClick={togglePlayback}
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
          >
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => nextTrack()}>
            <SkipForward size={20} />
          </Button>
        </div>

        <div className="flex items-center gap-4 text-muted-foreground">
          {lowPowerMode && (
            <div className="hidden lg:flex items-center bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-full text-[10px] font-bold">
              <Zap className="h-3 w-3 mr-1 fill-current" />
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
