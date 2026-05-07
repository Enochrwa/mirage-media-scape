import {
  Play, SkipBack, SkipForward, Repeat, Shuffle,
  Volume2, Mic2, ListMusic, MonitorSpeaker, Maximize2
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export function PlaybackController() {
  return (
    <div className="h-24 bg-zinc-950 border-t border-white/10 px-4 flex items-center justify-between z-50">
      {/* Current Track Info */}
      <div className="flex items-center gap-4 w-[30%]">
        <div className="w-14 h-14 bg-zinc-800 rounded-md overflow-hidden shadow-lg">
          <img src="https://picsum.photos/seed/current/56/56" alt="Now Playing" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold hover:underline cursor-pointer">Levitating (feat. DaBaby)</span>
          <span className="text-xs text-gray-400 hover:underline cursor-pointer">Dua Lipa</span>
        </div>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </Button>
      </div>

      {/* Player Controls */}
      <div className="flex flex-col items-center gap-2 max-w-[40%] w-full">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" className="text-purple-500 hover:text-purple-400" onClick={(e) => e.stopPropagation()}>
            <Shuffle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={(e) => e.stopPropagation()}>
            <SkipBack className="w-5 h-5 fill-current" />
          </Button>
          <Button size="icon" className="rounded-full bg-white text-black hover:scale-105 transition-transform w-8 h-8 p-0" onClick={(e) => e.stopPropagation()}>
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={(e) => e.stopPropagation()}>
            <SkipForward className="w-5 h-5 fill-current" />
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={(e) => e.stopPropagation()}>
            <Repeat className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 w-full">
          <span className="text-[10px] text-gray-400 min-w-[30px] text-right">1:24</span>
          <Slider defaultValue={[40]} max={100} step={1} className="w-full h-1" />
          <span className="text-[10px] text-gray-400 min-w-[30px]">3:23</span>
        </div>
      </div>

      {/* Volume & Extras */}
      <div className="flex items-center justify-end gap-3 w-[30%]">
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
          <Mic2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
          <ListMusic className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
          <MonitorSpeaker className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 w-24">
          <Volume2 className="w-4 h-4 text-gray-400" />
          <Slider defaultValue={[70]} max={100} step={1} className="h-1" />
        </div>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
