import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Repeat,
  Shuffle,
  Heart,
  ListMusic,
  Maximize2,
  Activity,
  ChevronUp,
  Mic2,
  Globe2,
  MonitorSpeaker,
  RotateCcw,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/utils';
import { WaveformSeekBar } from './WaveformSeekBar';
import { useState, useEffect, useRef } from 'react';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { resourceMonitor, ResourceState } from '@/engines/ResourceMonitor';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function PlaybackController() {
  const [spatialAudio, setSpatialAudio] = useState(playbackEngine.isSpatialAudioEnabled());
  const [resourceState, setResourceState] = useState<ResourceState>(resourceMonitor.getState());
  const [isFavorite, setIsFavorite] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    return resourceMonitor.subscribe(setResourceState);
  }, []);

  const toggleSpatialAudio = () => {
    const newState = !spatialAudio;
    setSpatialAudio(newState);
    playbackEngine.setSpatialAudioEnabled(newState);
  };

  const {
    currentFile,
    isPlaying,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    togglePlayback,
    nextTrack,
    previousTrack,
    volume,
    setVolume,
    currentTime,
    duration,
    seekTo,
    setPlayerFullscreen,
  } = usePlayerStore();

  const handleVolumeChange = (value: number[]) => {
    const v = value[0] / 100;
    setVolume(v);
    if (v > 0) setIsMuted(false);
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

  if (!currentFile) {
    return (
      <div className="z-50 flex h-20 items-center justify-center border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl">
        <p className="text-xs text-gray-500">Select a track to start listening</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="z-50 flex h-20 items-center justify-between gap-4 border-t border-white/10 bg-zinc-950/95 px-4 backdrop-blur-xl">
        {/* Left - Track info */}
        <div className="flex w-[30%] min-w-0 items-center gap-3">
          <div
            className="group relative h-14 w-14 flex-shrink-0 cursor-pointer overflow-hidden rounded-md shadow-lg"
            onClick={() => setPlayerFullscreen(true)}
          >
            <img
              src={currentFile.cover || 'https://picsum.photos/seed/zovyra/56/56'}
              alt={currentFile.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
              <ChevronUp size={18} className="text-white" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className="cursor-pointer truncate text-sm font-semibold text-white hover:underline"
                onClick={() => setPlayerFullscreen(true)}
              >
                {currentFile.title}
              </span>
              {currentFile.camelot_key && (
                <span className="flex-shrink-0 rounded border border-purple-500/30 bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-400">
                  {currentFile.camelot_key}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="cursor-pointer truncate text-xs text-gray-400 hover:text-white hover:underline">
                {currentFile.artist || 'Unknown Artist'}
              </span>
              {currentFile.bpm && (
                <span className="flex-shrink-0 font-mono text-[10px] text-zinc-500">
                  {Math.round(currentFile.bpm)} BPM
                </span>
              )}
            </div>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8 flex-shrink-0 text-gray-400 hover:text-white',
                  isFavorite && 'text-red-400 hover:text-red-300',
                )}
                onClick={() => setIsFavorite(!isFavorite)}
              >
                <Heart className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Center - Controls + Waveform */}
        <div className="flex w-full max-w-[40%] flex-col items-center gap-1.5">
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 text-gray-400 hover:text-white',
                    shuffle && 'text-purple-400 hover:text-purple-300',
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShuffle(!shuffle);
                  }}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Shuffle</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-300 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    previousTrack();
                  }}
                >
                  <SkipBack className="h-5 w-5 fill-current" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous</TooltipContent>
            </Tooltip>

            <Button
              size="icon"
              className="h-9 w-9 flex-shrink-0 rounded-full bg-white p-0 text-black shadow-lg transition-transform hover:scale-105 hover:bg-white/90"
              onClick={(e) => {
                e.stopPropagation();
                togglePlayback();
              }}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              )}
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-300 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextTrack();
                  }}
                >
                  <SkipForward className="h-5 w-5 fill-current" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 text-gray-400 hover:text-white',
                    repeat && 'text-purple-400 hover:text-purple-300',
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRepeat(!repeat);
                  }}
                >
                  <Repeat className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Repeat</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex w-full items-center gap-2">
            <span className="min-w-[36px] text-right font-mono text-[10px] text-gray-400">
              {formatDuration(currentTime)}
            </span>
            <div className="flex-1">
              <WaveformSeekBar trackId={currentFile.id} />
            </div>
            <span className="min-w-[36px] font-mono text-[10px] text-gray-400">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Right - Volume + extras */}
        <div className="flex w-[30%] items-center justify-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8 text-gray-400 hover:text-white',
                  spatialAudio && 'text-cyan-400 hover:text-cyan-300',
                )}
                onClick={toggleSpatialAudio}
              >
                <Globe2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Spatial Audio {spatialAudio ? 'On' : 'Off'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white"
              >
                <ListMusic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Queue</TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-white"
                  onClick={toggleMute}
                >
                  <VolumeIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle mute</TooltipContent>
            </Tooltip>
            <div className="w-24">
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                max={100}
                step={1}
                onValueChange={handleVolumeChange}
                className="h-1"
              />
            </div>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white"
                onClick={() => setPlayerFullscreen(true)}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open full player</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
