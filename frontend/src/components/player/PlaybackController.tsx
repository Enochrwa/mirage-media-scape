import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Repeat,
  Shuffle,
  Heart,
  Mic2,
  ListMusic,
  Maximize2,
  MonitorSpeaker,
  Globe2,
  Activity,
  RotateCcw,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/utils';
import { WaveformSeekBar } from './WaveformSeekBar';
import { useState, useEffect } from 'react';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { resourceMonitor, ResourceState } from '@/lib/ResourceMonitor';
import { EqualizerControls } from './EqualizerControls';

export function PlaybackController() {
  const [showEQ, setShowEQ] = useState(false);
  const [spatialAudio, setSpatialAudio] = useState(playbackEngine.isSpatialAudioEnabled());
  const [resourceState, setResourceState] = useState<ResourceState>(resourceMonitor.getState());

  useEffect(() => {
    return resourceMonitor.subscribe(setResourceState);
  }, []);

  const toggleSpatialAudio = () => {
    const newState = !spatialAudio;
    setSpatialAudio(newState);
    playbackEngine.setSpatialAudioEnabled(newState);
  };

  const toggleABLoop = () => {
    playbackEngine.abLoop.toggle();
  };

  const setLoopA = () => {
    playbackEngine.abLoop.setA(playbackEngine.currentTime);
  };

  const setLoopB = () => {
    playbackEngine.abLoop.setB(playbackEngine.currentTime);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '[') setLoopA();
      else if (e.key === ']') setLoopB();
      else if (e.key === '\\') toggleABLoop();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  } = usePlayerStore();

  const { files } = useLibraryStore();

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0] / 100);
  };

  if (!currentFile) {
    return (
      <div className="z-50 flex h-24 items-center justify-center border-t border-white/10 bg-zinc-950 px-4">
        <p className="text-sm text-gray-500">Select a track to start listening</p>
      </div>
    );
  }

  return (
    <div className="z-50 flex h-24 items-center justify-between border-t border-white/10 bg-zinc-950 px-4">
      <div className="flex w-[30%] items-center gap-4">
        <div className="h-14 w-14 overflow-hidden rounded-md bg-zinc-800 shadow-lg">
          <img
            src={currentFile.cover || 'https://picsum.photos/seed/zovyra/56/56'}
            alt={currentFile.title}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="cursor-pointer truncate text-sm font-semibold hover:underline">
              {currentFile.title}
            </span>
            {currentFile.camelot_key && (
              <span className="shrink-0 rounded border border-purple-500/30 bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-400">
                {currentFile.camelot_key}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="cursor-pointer truncate text-xs text-gray-400 hover:underline">
              {currentFile.artist || 'Unknown Artist'}
            </span>
            {currentFile.bpm && (
              <span className="font-mono text-[10px] text-zinc-500">
                {Math.round(currentFile.bpm)} BPM
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 text-gray-400 hover:text-white">
          <Heart className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex w-full max-w-[40%] flex-col items-center gap-2">
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            size="icon"
            className={cn('text-purple-500 hover:text-purple-400', shuffle && 'bg-purple-500/10')}
            onClick={(e) => {
              e.stopPropagation();
              setShuffle(!shuffle);
            }}
          >
            <Shuffle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              previousTrack(files);
            }}
          >
            <SkipBack className="h-5 w-5 fill-current" />
          </Button>
          <Button
            size="icon"
            className="h-8 w-8 rounded-full bg-white p-0 text-black transition-transform hover:scale-105"
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
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              nextTrack(files);
            }}
          >
            <SkipForward className="h-5 w-5 fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'text-gray-400 hover:text-white',
              repeat && 'bg-purple-500/10 text-purple-400',
            )}
            onClick={(e) => {
              e.stopPropagation();
              setRepeat(!repeat);
            }}
          >
            <Repeat className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex w-full items-center gap-2">
          <span className="min-w-[35px] text-right text-[10px] text-gray-400">
            {formatDuration(currentTime)}
          </span>
          <div className="flex-1 px-2">
            <WaveformSeekBar trackId={currentFile.id} />
          </div>
          <span className="min-w-[35px] text-[10px] text-gray-400">{formatDuration(duration)}</span>
        </div>
      </div>

      <div className="relative flex w-[30%] items-center justify-end gap-3">
        <div className="flex w-24 items-center gap-2">
          <Volume2 className="h-4 w-4 text-gray-400" />
          <Slider
            value={[volume * 100]}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            className="h-1"
          />
        </div>
      </div>
    </div>
  );
}
