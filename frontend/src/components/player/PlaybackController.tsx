import {
  Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, Heart,
  Mic2, ListMusic, Maximize2, MonitorSpeaker, Globe2, Activity,
  RotateCcw
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";
import WaveformSeekBar from "./WaveformSeekBar";
import { useState, useEffect } from "react";
import { playbackEngine } from "@/lib/PlaybackEngine";
import { resourceMonitor, ResourceState } from "@/lib/ResourceMonitor";
import { EqualizerControls } from "./EqualizerControls";

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
    seekTo
  } = usePlayerStore();

  const { files } = useLibraryStore();

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0] / 100);
  };

  if (!currentFile) {
    return (
      <div className="h-24 bg-zinc-950 border-t border-white/10 px-4 flex items-center justify-center z-50">
        <p className="text-gray-500 text-sm">Select a track to start listening</p>
      </div>
    );
  }

  return (
    <div className="h-24 bg-zinc-950 border-t border-white/10 px-4 flex items-center justify-between z-50">
      <div className="flex items-center gap-4 w-[30%]">
        <div className="w-14 h-14 bg-zinc-800 rounded-md overflow-hidden shadow-lg">
          <img
            src={currentFile.cover || "https://picsum.photos/seed/sonic/56/56"}
            alt={currentFile.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold hover:underline cursor-pointer truncate">
              {currentFile.title}
            </span>
            {currentFile.camelot_key && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                {currentFile.camelot_key}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 hover:underline cursor-pointer truncate">
              {currentFile.artist || "Unknown Artist"}
            </span>
            {currentFile.bpm && (
              <span className="text-[10px] text-zinc-500 font-mono">
                {Math.round(currentFile.bpm)} BPM
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white shrink-0">
          <Heart className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-2 max-w-[40%] w-full">
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            size="icon"
            className={cn("text-purple-500 hover:text-purple-400", shuffle && "bg-purple-500/10")}
            onClick={(e) => { e.stopPropagation(); setShuffle(!shuffle); }}
          >
            <Shuffle className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
            onClick={(e) => { e.stopPropagation(); previousTrack(files); }}
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </Button>
          <Button
            size="icon"
            className="rounded-full bg-white text-black hover:scale-105 transition-transform w-8 h-8 p-0"
            onClick={(e) => { e.stopPropagation(); togglePlayback(); }}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
            onClick={(e) => { e.stopPropagation(); nextTrack(files); }}
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("text-gray-400 hover:text-white", repeat && "text-purple-400 bg-purple-500/10")}
            onClick={(e) => { e.stopPropagation(); setRepeat(!repeat); }}
          >
            <Repeat className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 w-full">
          <span className="text-[10px] text-gray-400 min-w-[35px] text-right">
            {formatDuration(currentTime)}
          </span>
          <div className="flex-1 px-2">
            <WaveformSeekBar trackId={currentFile.id} />
          </div>
          <span className="text-[10px] text-gray-400 min-w-[35px]">
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 w-[30%] relative">
        <div className="flex items-center gap-2 w-24">
          <Volume2 className="w-4 h-4 text-gray-400" />
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
