import { Slider } from '@/components/ui/slider';
import { Zap, Moon, Coffee, PartyPopper } from 'lucide-react';

export function MoodSlider() {
  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-900/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">AI Mood Engine</h3>
        <span className="font-mono text-xs uppercase text-purple-400">Optimizing Flow</span>
      </div>

      <div className="mb-8 flex items-center gap-4">
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <Moon className="h-5 w-5" />
          <span className="text-[10px]">Chill</span>
        </div>
        <Slider defaultValue={[50]} max={100} step={1} className="flex-1" />
        <div className="flex flex-col items-center gap-2 text-purple-500">
          <Zap className="h-5 w-5" />
          <span className="text-[10px]">Hype</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 p-3 text-sm transition-colors hover:bg-white/10">
          <Coffee className="h-4 w-4 text-orange-400" />
          Focus
        </button>
        <button className="flex items-center justify-center gap-2 rounded-xl border border-purple-500/20 bg-purple-600/20 p-3 text-sm text-purple-300 transition-colors hover:bg-purple-600/30">
          <PartyPopper className="h-4 w-4 text-purple-400" />
          Party
        </button>
      </div>
    </div>
  );
}
