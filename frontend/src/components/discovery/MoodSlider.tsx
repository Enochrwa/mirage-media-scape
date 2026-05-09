import { Slider } from "@/components/ui/slider";
import { Zap, Moon, Coffee, PartyPopper } from "lucide-react";

export function MoodSlider() {
  return (
    <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">AI Mood Engine</h3>
        <span className="text-xs text-purple-400 font-mono uppercase">Optimizing Flow</span>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <Moon className="w-5 h-5" />
          <span className="text-[10px]">Chill</span>
        </div>
        <Slider
          defaultValue={[50]}
          max={100}
          step={1}
          className="flex-1"
        />
        <div className="flex flex-col items-center gap-2 text-purple-500">
          <Zap className="w-5 h-5" />
          <span className="text-[10px]">Hype</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm border border-white/5">
          <Coffee className="w-4 h-4 text-orange-400" />
          Focus
        </button>
        <button className="flex items-center justify-center gap-2 p-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 transition-colors text-sm border border-purple-500/20 text-purple-300">
          <PartyPopper className="w-4 h-4 text-purple-400" />
          Party
        </button>
      </div>
    </div>
  );
}
