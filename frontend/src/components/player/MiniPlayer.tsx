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
  Heart,
  X,
  Repeat,
  Repeat1,
  Shuffle,
  Radio,
  Disc3,
} from 'lucide-react';
import { useLowPowerMode } from '@/hooks/useLowPowerMode';
import { useTrackFavorite } from '@/hooks/useTrackFavorite';
import { useRadioNowPlaying } from '@/hooks/useRadioNowPlaying';
import { Button } from '@/components/ui/button';
import { cn, formatDuration } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';

export const MiniPlayer: React.FC = () => {
  const [tooltipTime, setTooltipTime] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
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
    repeatMode,
    cycleRepeat,
  } = usePlayerStore();
  const lowPowerMode = useLowPowerMode();

  const isRadioFile = Boolean(currentFile?.isStream) || currentFile?.album === 'Radio';
  const { isFavorite, toggle: toggleFavorite } = useTrackFavorite(
    currentFile && !isRadioFile ? currentFile.id : undefined,
  );
  const { nowPlayingTitle, isReconnecting } = useRadioNowPlaying(currentFile);

  if (!currentFile) return null;

  const isRadio = isRadioFile || !duration;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressMouseMove = (e: React.MouseEvent) => {
    if (!progressRef.current || isRadio) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    setTooltipTime(formatDuration(percent * duration));
    setTooltipPos(percent * 100);
  };

  const handleSeekClick = (e: React.MouseEvent) => {
    if (!progressRef.current || isRadio) return;
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
      <div className="bg-background/92 fixed bottom-14 left-0 right-0 z-40 border-t border-border/40 backdrop-blur-2xl md:bottom-0">
        {/* ── Seek / Live bar ── */}
        <div
          ref={progressRef}
          className={cn(
            'group relative w-full transition-all',
            isRadio ? 'h-0.5 cursor-default' : 'h-1 cursor-pointer hover:h-[5px] active:h-[5px]',
          )}
          onMouseEnter={() => setIsHoveringProgress(true)}
          onMouseLeave={() => {
            setIsHoveringProgress(false);
            setTooltipTime(null);
          }}
          onMouseMove={handleProgressMouseMove}
          onClick={handleSeekClick}
          onTouchStart={(e) => {
            if (isRadio || !progressRef.current) return;
            const rect = progressRef.current.getBoundingClientRect();
            const percent = Math.max(
              0,
              Math.min(1, (e.touches[0].clientX - rect.left) / rect.width),
            );
            usePlayerStore.getState().seekTo(percent * duration);
          }}
          onTouchMove={(e) => {
            if (isRadio || !progressRef.current) return;
            e.preventDefault();
            const rect = progressRef.current.getBoundingClientRect();
            const percent = Math.max(
              0,
              Math.min(1, (e.touches[0].clientX - rect.left) / rect.width),
            );
            usePlayerStore.getState().seekTo(percent * duration);
          }}
        >
          {isRadio ? (
            /* Animated live bar for radio */
            <div className="h-full w-full overflow-hidden bg-gradient-to-r from-purple-600/20 via-fuchsia-500/40 to-purple-600/20">
              <div className="h-full w-1/3 animate-[slide_2s_linear_infinite] bg-gradient-to-r from-transparent via-purple-400/70 to-transparent" />
            </div>
          ) : (
            <>
              <div className="h-full bg-primary/10" />
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-none"
                style={{ width: `${progress}%` }}
              />
              <div
                className={cn(
                  'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg transition-opacity',
                  isHoveringProgress ? 'opacity-100' : 'opacity-0',
                )}
                style={{ left: `${progress}%` }}
              />
              {tooltipTime && (
                <div
                  className="pointer-events-none absolute bottom-3 rounded-md bg-zinc-900/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-xl ring-1 ring-white/10 backdrop-blur-sm"
                  style={{ left: `${tooltipPos}%`, transform: 'translateX(-50%)' }}
                >
                  {tooltipTime}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Main bar ── */}
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-2 px-3 md:px-5">
          {/* Track info */}
          <div
            className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3"
            onClick={() => !isRadio && setPlayerFullscreen(true)}
          >
            {/* Album art with spinning vinyl effect when playing */}
            <div className="relative h-11 w-11 flex-shrink-0">
              <div
                className={cn(
                  'h-full w-full overflow-hidden rounded-lg shadow-md ring-1 ring-white/10 transition-all duration-700',
                  isPlaying && !isRadio && 'animate-[spin_8s_linear_infinite]',
                )}
              >
                {currentFile.cover ? (
                  <img
                    src={currentFile.cover}
                    alt={currentFile.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-700 to-fuchsia-700">
                    {isRadio ? (
                      <Radio size={18} className="text-white/70" />
                    ) : (
                      <Disc3 size={18} className="text-white/70" />
                    )}
                  </div>
                )}
              </div>
              {isPlaying && (
                <div className="pointer-events-none absolute inset-0 animate-pulse rounded-lg ring-2 ring-purple-500/50" />
              )}
            </div>

            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <h4 className="truncate text-sm font-semibold leading-tight text-foreground">
                  {isRadio && nowPlayingTitle ? nowPlayingTitle : currentFile.title}
                </h4>
                {!isRadio && (
                  <ChevronUp
                    size={13}
                    className="flex-shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground"
                  />
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground/70">
                {isRadio && nowPlayingTitle
                  ? currentFile.title
                  : currentFile.artist || currentFile.album}
                {isRadio && (
                  <span
                    className={cn(
                      'ml-2 inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-bold',
                      isReconnecting
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400',
                    )}
                  >
                    {isReconnecting ? '◌ RECONNECTING' : '● LIVE'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* ── Centre controls ── */}
          <div className="flex items-center gap-0.5">
            {/* Shuffle — hidden for radio */}
            {!isRadio && (
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
            )}

            {/* Favorite — persisted via track_likes; not shown for radio,
                which has its own separate station-favorites system on the
                Radio page (different table, different identity: stationuuid
                vs trackId) */}
            {!isRadio && (
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
                    onClick={() => void toggleFavorite()}
                  >
                    <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isFavorite ? 'Unfavorite' : 'Favourite'}</TooltipContent>
              </Tooltip>
            )}

            {/* Prev */}
            {!isRadio && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-foreground/80 hover:text-foreground"
                onClick={() => previousTrack()}
              >
                <SkipBack size={17} fill="currentColor" />
              </Button>
            )}

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
            {!isRadio && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-foreground/80 hover:text-foreground"
                onClick={() => nextTrack()}
              >
                <SkipForward size={17} fill="currentColor" />
              </Button>
            )}

            {/* Repeat — 3-state cycle: off → all → one, matching the
                convention every mainstream player uses */}
            {!isRadio && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'hidden h-8 w-8 sm:inline-flex',
                      repeatMode !== 'off'
                        ? 'text-purple-400 hover:text-purple-300'
                        : 'text-muted-foreground/60 hover:text-foreground',
                    )}
                    onClick={cycleRepeat}
                  >
                    {repeatMode === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {repeatMode === 'off' && 'Repeat off'}
                  {repeatMode === 'all' && 'Repeat all'}
                  {repeatMode === 'one' && 'Repeat one'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* ── Right side ── */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 md:gap-2">
            {/* Time display */}
            {!isRadio && duration > 0 && (
              <div className="hidden font-mono text-[11px] text-muted-foreground/50 md:block">
                {formatDuration(currentTime)}
                <span className="mx-0.5 text-muted-foreground/25">/</span>
                {formatDuration(duration)}
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
                  onClick={() => !isRadio && setPlayerFullscreen(true)}
                >
                  <ListMusic size={15} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Queue</TooltipContent>
            </Tooltip>

            {/* Close player */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground/50 hover:text-destructive"
                  onClick={closePlayer}
                >
                  <X size={15} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stop & close</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
