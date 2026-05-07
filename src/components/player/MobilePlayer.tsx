import {
  Play, SkipBack, SkipForward, Repeat, Shuffle,
  Volume2, Mic2, ListMusic, MonitorSpeaker, Maximize2,
  ChevronDown, MoreVertical, Share2
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export function MobilePlayer({ onClose }: { onClose?: () => void }) {
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-purple-900/40 to-black z-[100] flex flex-col p-8 md:hidden">
      <div className="flex items-center justify-between mb-12">
        <Button variant="ghost" size="icon" className="text-white" onClick={(e) => { e.stopPropagation(); onClose?.(); }}>
          <ChevronDown className="w-8 h-8" />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Playing from Playlist</span>
          <span className="text-sm font-bold">Future Nostalgia</span>
        </div>
        <Button variant="ghost" size="icon" className="text-white">
          <MoreVertical className="w-6 h-6" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="aspect-square w-full rounded-2xl overflow-hidden shadow-2xl mb-12">
          <img
            src="https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=800&q=80"
            className="w-full h-full object-cover"
            alt="Album Art"
          />
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Levitating</h2>
            <p className="text-purple-400 font-medium">Dua Lipa</p>
          </div>
          <Button variant="ghost" size="icon" className="text-white">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </Button>
        </div>

        <div className="space-y-2 mb-10">
          <Slider defaultValue={[40]} max={100} step={1} className="h-1.5" />
          <div className="flex justify-between text-xs text-gray-400">
            <span>1:24</span>
            <span>3:23</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-12">
          <Button variant="ghost" size="icon" className="text-purple-400">
            <Shuffle className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-8">
            <Button variant="ghost" size="icon" className="text-white">
              <SkipBack className="w-10 h-10 fill-current" />
            </Button>
            <Button size="icon" className="rounded-full bg-white text-black w-20 h-20 p-0 shadow-xl">
              <Play className="w-10 h-10 fill-current ml-1" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white">
              <SkipForward className="w-10 h-10 fill-current" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="text-white">
            <Repeat className="w-6 h-6" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="text-gray-400">
          <MonitorSpeaker className="w-6 h-6" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-400">
          <Share2 className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
