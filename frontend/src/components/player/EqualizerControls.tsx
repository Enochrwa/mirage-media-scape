import React, { useEffect, useRef, useState, useCallback } from 'react';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, Save, Trash2, Power, Zap } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { API_BASE } from '@/lib/utils';
import { toast } from 'sonner';

interface EqualizerControlsProps {
  onClose: () => void;
}

interface EQPreset {
  id: string;
  name: string;
  bands: number[];
  is_system: boolean;
}

const BANDS = [
  { label: '80Hz', sub: 'Bass' },
  { label: '250Hz', sub: 'Low Mid' },
  { label: '1kHz', sub: 'Mid' },
  { label: '4kHz', sub: 'High Mid' },
  { label: '12kHz', sub: 'Treble' },
];

const SYSTEM_PRESETS: EQPreset[] = [
  { id: 'flat', name: 'Flat', bands: [0, 0, 0, 0, 0], is_system: true },
  { id: 'acoustic', name: 'Acoustic', bands: [3, 2, 0, 2, 3], is_system: true },
  { id: 'bass-boost', name: 'Bass Boost', bands: [6, 3, 0, 0, 0], is_system: true },
  { id: 'bass-reducer', name: 'Bass Reducer', bands: [-6, -3, 0, 0, 0], is_system: true },
  { id: 'classical', name: 'Classical', bands: [4, 3, 0, 3, 4], is_system: true },
  { id: 'dance', name: 'Dance', bands: [5, 0, 2, 4, 3], is_system: true },
  { id: 'deep', name: 'Deep', bands: [4, 2, 0, -2, -4], is_system: true },
  { id: 'electronic', name: 'Electronic', bands: [4, 2, 0, 2, 4], is_system: true },
  { id: 'hip-hop', name: 'Hip-Hop', bands: [5, 3, 0, 2, 3], is_system: true },
  { id: 'jazz', name: 'Jazz', bands: [3, 2, -1, 2, 3], is_system: true },
  { id: 'latin', name: 'Latin', bands: [3, 0, 0, 2, 4], is_system: true },
  { id: 'loudness', name: 'Loudness', bands: [6, 0, -2, 0, 4], is_system: true },
  { id: 'pop', name: 'Pop', bands: [-2, -1, 0, 2, 4], is_system: true },
  { id: 'rock', name: 'Rock', bands: [4, 3, -1, 3, 5], is_system: true },
];

export const EqualizerControls: React.FC<EqualizerControlsProps> = ({ onClose }) => {
  const [gains, setGains] = useState<number[]>([0, 0, 0, 0, 0]);
  const [enabled, setEnabled] = useState(true);
  const [presets, setPresets] = useState<EQPreset[]>(SYSTEM_PRESETS);
  const [selectedPreset, setSelectedPreset] = useState<string>('flat');
  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const persistenceTimer = useRef<NodeJS.Timeout | null>(null);

  const persistBands = useCallback((newGains: number[]) => {
    if (persistenceTimer.current) clearTimeout(persistenceTimer.current);
    persistenceTimer.current = setTimeout(() => {
      localStorage.setItem('ZOVYRA_eq_bands', JSON.stringify(newGains));
      fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'eq_bands', value: JSON.stringify(newGains) }),
      }).catch(console.error);
    }, 300);
  }, []);

  const handleGainChange = (index: number, value: number[]) => {
    const newGains = [...gains];
    newGains[index] = value[0];
    setGains(newGains);
    if (enabled) {
      playbackEngine.setEQBand(index, value[0]);
    }
    persistBands(newGains);
    setSelectedPreset('custom');
  };

  const applyPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setGains(preset.bands);
      preset.bands.forEach((g, i) => {
        if (enabled) playbackEngine.setEQBand(i, g);
      });
      setSelectedPreset(presetId);
      persistBands(preset.bands);
    }
  };

  const toggleEnabled = (val: boolean) => {
    setEnabled(val);
    gains.forEach((g, i) => {
      playbackEngine.setEQBand(i, val ? g : 0);
    });
  };

  const toggleBassBoost = () => {
    const isBoosted = gains[0] === 6 && gains[1] === 3;
    if (isBoosted) {
      applyPreset('flat');
    } else {
      applyPreset('bass-boost');
    }
  };

  const loadCustomPresets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/eq-presets`);
      const data = await res.json();
      if (data && Array.isArray(data)) {
        setPresets([...SYSTEM_PRESETS, ...data]);
      }
    } catch (e) {
      console.error('Failed to load EQ presets', e);
    }
  };

  const savePreset = async () => {
    if (!newPresetName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/eq-presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPresetName, bands: gains }),
      });
      const newPreset = await res.json();
      setPresets(prev => [...prev, newPreset]);
      setSelectedPreset(newPreset.id);
      setNewPresetName('');
      toast.success('Preset saved');
    } catch (e) {
      toast.error('Failed to save preset');
    } finally {
      setIsSaving(false);
    }
  };

  const deletePreset = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/eq-presets/${id}`, { method: 'DELETE' });
      setPresets(prev => prev.filter(p => p.id !== id));
      if (selectedPreset === id) setSelectedPreset('flat');
      toast.success('Preset deleted');
    } catch (e) {
      toast.error('Failed to delete preset');
    }
  };

  useEffect(() => {
    loadCustomPresets();
    const saved = localStorage.getItem('ZOVYRA_eq_bands');
    if (saved) {
      const parsed = JSON.parse(saved);
      setGains(parsed);
      parsed.forEach((g: number, i: number) => playbackEngine.setEQBand(i, g));
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawCurve = () => {
      const width = canvas.width;
      const height = canvas.height;
      const frequencies = new Float32Array(width);
      for (let i = 0; i < width; i++) {
        frequencies[i] = 20 * Math.pow(1000, i / width);
      }

      const response = playbackEngine.getFrequencyResponse(frequencies);

      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 3;

      for (let i = 0; i < width; i++) {
        const db = 20 * Math.log10(response[i]);
        const y = height / 2 - (db * height) / 40; // 40dB range
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      ctx.stroke();

      // Draw grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    drawCurve();
  }, [gains]);

  return (
    <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl backdrop-blur-xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <span className="h-6 w-2 rounded-full bg-purple-500" />
            Parametric Equalizer
          </h3>
          <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1">
            <Power className={cn("h-3 w-3", enabled ? "text-purple-500" : "text-gray-600")} />
            <div className="scale-75 origin-right">
              <Switch checked={enabled} onCheckedChange={toggleEnabled} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={gains[0] === 6 ? "default" : "ghost"} size="sm" onClick={toggleBassBoost} className="gap-2 text-xs">
            <Zap className="h-3 w-3" /> Bass Boost
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-gray-400">Preset</Label>
          <div className="flex gap-2">
            <Select value={selectedPreset} onValueChange={applyPreset}>
              <SelectTrigger className="w-full bg-black/40">
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom" disabled>Custom</SelectItem>
                {presets.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPreset !== 'flat' && !presets.find(p => p.id === selectedPreset)?.is_system && (
              <Button variant="destructive" size="icon" onClick={() => deletePreset(selectedPreset)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-gray-400">Save Custom</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Preset Name"
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
              className="bg-black/40"
            />
            <Button size="icon" onClick={savePreset} disabled={isSaving || !newPresetName}>
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-lg bg-black/40 p-4">
        <canvas ref={canvasRef} width={600} height={150} className="h-[150px] w-full" />
      </div>

      <div className="flex h-64 items-end justify-between gap-4 px-4">
        {BANDS.map((band, i) => (
          <div key={band.label} className="flex flex-1 flex-col items-center gap-4">
            <div className="relative flex h-48 w-full justify-center">
              <Slider
                orientation="vertical"
                value={[gains[i]]}
                min={-12}
                max={12}
                step={0.5}
                onValueChange={(v) => handleGainChange(i, v)}
                className="h-full"
              />
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-white">{band.label}</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">{band.sub}</div>
              <div className="mt-1 font-mono text-[10px] text-purple-400">
                {gains[i] > 0 ? '+' : ''}
                {gains[i].toFixed(1)}dB
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
