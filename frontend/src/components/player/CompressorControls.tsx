import React, { useState, useEffect, useRef } from 'react';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Power, Settings2, Moon, Activity } from 'lucide-react';
import { cn, API_BASE } from '@/lib/utils';

export const CompressorControls: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<'off' | 'standard' | 'night'>('off');
  const [advanced, setAdvanced] = useState(false);
  const [params, setParams] = useState({
    threshold: -24,
    ratio: 4,
    knee: 30,
    attack: 0.003,
    release: 0.25,
  });
  const [reduction, setReduction] = useState(0);
  const rafRef = useRef<number>();

  const updateParam = (key: keyof typeof params, value: number) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    playbackEngine.setCompressorParams({ ...newParams, enabled });
    persistSettings(newParams, enabled, mode);
  };

  const persistSettings = (p: typeof params, e: boolean, m: string) => {
    localStorage.setItem(
      'ZOVYRA_compressor_settings',
      JSON.stringify({ params: p, enabled: e, mode: m }),
    );
    fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'compressor_settings',
        value: JSON.stringify({ params: p, enabled: e, mode: m }),
      }),
    }).catch(console.error);
  };

  const setModeAndApply = (newMode: 'off' | 'standard' | 'night') => {
    setMode(newMode);
    if (newMode === 'off') {
      setEnabled(false);
      playbackEngine.setCompressorParams({ enabled: false });
    } else if (newMode === 'standard') {
      setEnabled(true);
      const p = { threshold: -16, ratio: 4, knee: 12, attack: 0.003, release: 0.25 };
      setParams(p);
      playbackEngine.setCompressorParams({ ...p, enabled: true });
    } else if (newMode === 'night') {
      setEnabled(true);
      const p = { threshold: -30, ratio: 12, knee: 40, attack: 0.003, release: 0.25 };
      setParams(p);
      playbackEngine.setCompressorParams({ ...p, enabled: true });
    }
    persistSettings(params, newMode !== 'off', newMode);
  };

  useEffect(() => {
    const updateMeter = () => {
      setReduction(playbackEngine.getCompressorReduction());
      rafRef.current = requestAnimationFrame(updateMeter);
    };
    updateMeter();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('ZOVYRA_compressor_settings');
    if (saved) {
      const { params: p, enabled: e, mode: m } = JSON.parse(saved);
      setParams(p);
      setEnabled(e);
      setMode(m);
      playbackEngine.setCompressorParams({ ...p, enabled: e });
    }
  }, []);

  return (
    <div className="space-y-6 rounded-xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold">
          <Activity className="h-4 w-4 text-orange-500" />
          Dynamics Compressor
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAdvanced(!advanced)}
            className={cn('h-8 gap-2 px-3 text-xs', advanced && 'bg-white/10')}
          >
            <Settings2 className="h-3 w-3" />
            Advanced
          </Button>
          <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1">
            <Power className={cn('h-3 w-3', enabled ? 'text-orange-500' : 'text-gray-600')} />
            <Switch
              checked={enabled}
              onCheckedChange={(val) => {
                setEnabled(val);
                playbackEngine.setCompressorParams({ ...params, enabled: val });
                if (!val) setMode('off');
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['off', 'standard', 'night'] as const).map((m) => (
          <Button
            key={m}
            variant={mode === m ? 'default' : 'secondary'}
            onClick={() => setModeAndApply(m)}
            className="h-10 capitalize"
          >
            {m === 'night' && <Moon className="mr-2 h-4 w-4" />}
            {m}
          </Button>
        ))}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-gray-500">
          <span>Gain Reduction</span>
          <span className="font-mono">{reduction.toFixed(1)} dB</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-75"
            style={{ width: `${Math.min(100, (Math.abs(reduction) / 20) * 100)}%` }}
          />
        </div>
      </div>

      {advanced && (
        <div className="grid grid-cols-1 gap-6 border-t border-white/5 pt-4 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-xs">Threshold</Label>
              <span className="font-mono text-xs">{params.threshold} dB</span>
            </div>
            <Slider
              value={[params.threshold]}
              min={-60}
              max={0}
              step={1}
              onValueChange={([v]) => updateParam('threshold', v)}
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-xs">Ratio</Label>
              <span className="font-mono text-xs">{params.ratio}:1</span>
            </div>
            <Slider
              value={[params.ratio]}
              min={1}
              max={20}
              step={0.1}
              onValueChange={([v]) => updateParam('ratio', v)}
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-xs">Knee</Label>
              <span className="font-mono text-xs">{params.knee}</span>
            </div>
            <Slider
              value={[params.knee]}
              min={0}
              max={40}
              step={1}
              onValueChange={([v]) => updateParam('knee', v)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
