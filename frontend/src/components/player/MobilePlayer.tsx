import {
  Play,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Volume2,
  Mic2,
  ListMusic,
  MonitorSpeaker,
  Maximize2,
  ChevronDown,
  MoreVertical,
  Share2,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

export function MobilePlayer({ onClose }: { onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-purple-900/40 to-black p-8 md:hidden">
      <div className="mb-12 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="text-white"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
        >
          <ChevronDown className="h-8 w-8" />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Playing from Playlist
          </span>
          <span className="text-sm font-bold">Future Nostalgia</span>
        </div>
        <Button variant="ghost" size="icon" className="text-white">
          <MoreVertical className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-12 aspect-square w-full overflow-hidden rounded-2xl shadow-2xl">
          <img
            src="https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=800&q=80"
            className="h-full w-full object-cover"
            alt="Album Art"
          />
        </div>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Levitating</h2>
            <p className="font-medium text-purple-400">Dua Lipa</p>
          </div>
          <Button variant="ghost" size="icon" className="text-white">
            <svg
              className="h-7 w-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </Button>
        </div>

        <div className="mb-10 space-y-2">
          <Slider defaultValue={[40]} max={100} step={1} className="h-1.5" />
          <div className="flex justify-between text-xs text-gray-400">
            <span>1:24</span>
            <span>3:23</span>
          </div>
        </div>

        <div className="mb-12 flex items-center justify-between">
          <Button variant="ghost" size="icon" className="text-purple-400">
            <Shuffle className="h-6 w-6" />
          </Button>
          <div className="flex items-center gap-8">
            <Button variant="ghost" size="icon" className="text-white">
              <SkipBack className="h-10 w-10 fill-current" />
            </Button>
            <Button
              size="icon"
              className="h-20 w-20 rounded-full bg-white p-0 text-black shadow-xl"
            >
              <Play className="ml-1 h-10 w-10 fill-current" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white">
              <SkipForward className="h-10 w-10 fill-current" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="text-white">
            <Repeat className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="text-gray-400">
          <MonitorSpeaker className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-400">
          <Share2 className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
