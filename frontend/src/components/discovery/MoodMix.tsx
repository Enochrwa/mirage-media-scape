import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sparkles, Play } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { queueManager } from '@/engines/QueueManager';
import { API_BASE } from '@/lib/utils';

const MoodMix: React.FC = () => {
  const { playFile } = usePlayerStore();
  const [energy, setEnergy] = useState([0.5]);
  const [tempo, setTempo] = useState([120]);

  const generateMix = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/tracks/recommendations/mood?energy=${energy[0]}&bpm=${tempo[0]}&limit=50`,
      );
      if (res.ok) {
        const { data: tracks } = await res.json();
        if (tracks && tracks.length > 0) {
          queueManager.setQueue(tracks);
          playFile(tracks[0]);
        }
      }
    } catch (e) {
      console.error('Failed to generate mood mix', e);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-purple-500/30 text-purple-400 hover:text-purple-300"
        >
          <Sparkles className="h-4 w-4" />
          Mood Mix
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-6 border-zinc-800 bg-zinc-900 p-6">
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-purple-400" />
            Mood Mix
          </h3>
          <p className="text-xs text-zinc-400">Generate a playlist based on your current vibe.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-[10px] uppercase text-zinc-500">Energy</span>
              <span>{Math.round(energy[0] * 100)}%</span>
            </div>
            <Slider value={energy} min={0} max={1} step={0.01} onValueChange={setEnergy} />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-[10px] uppercase text-zinc-500">Tempo</span>
              <span>{Math.round(tempo[0])} BPM</span>
            </div>
            <Slider value={tempo} min={60} max={200} step={1} onValueChange={setTempo} />
          </div>
        </div>

        <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-500" onClick={generateMix}>
          <Play className="h-4 w-4 fill-current" />
          Generate & Play
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export default MoodMix;
