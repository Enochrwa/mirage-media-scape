import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sparkles, Play } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { API_BASE } from '@/lib/utils';

const MoodMix: React.FC = () => {
    const { playFile } = usePlayerStore();
    const [energy, setEnergy] = useState([0.5]);
    const [tempo, setTempo] = useState([120]);

    const generateMix = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/tracks/recommend/mood?energy=${energy[0]}&bpm=${tempo[0]}&limit=50`);
            if (res.ok) {
                const tracks = await res.json();
                if (tracks.length > 0) {
                    playFile(tracks[0]);
                    // TODO: Replace queue with tracks
                }
            }
        } catch (e) {
            console.error('Failed to generate mood mix', e);
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 border-purple-500/30 text-purple-400 hover:text-purple-300">
                    <Sparkles className="w-4 h-4" />
                    Mood Mix
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-6 bg-zinc-900 border-zinc-800 space-y-6">
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        Mood Mix
                    </h3>
                    <p className="text-xs text-zinc-400">Generate a playlist based on your current vibe.</p>
                </div>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs font-medium">
                            <span className="text-zinc-500 text-[10px] uppercase">Energy</span>
                            <span>{Math.round(energy[0] * 100)}%</span>
                        </div>
                        <Slider value={energy} min={0} max={1} step={0.01} onValueChange={setEnergy} />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between text-xs font-medium">
                            <span className="text-zinc-500 text-[10px] uppercase">Tempo</span>
                            <span>{Math.round(tempo[0])} BPM</span>
                        </div>
                        <Slider value={tempo} min={60} max={200} step={1} onValueChange={setTempo} />
                    </div>
                </div>

                <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-500" onClick={generateMix}>
                    <Play className="w-4 h-4 fill-current" />
                    Generate & Play
                </Button>
            </PopoverContent>
        </Popover>
    );
};

export default MoodMix;
