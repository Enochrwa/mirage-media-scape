import React, { useEffect, useRef, useState } from 'react';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface EqualizerControlsProps {
  onClose: () => void;
}

const BANDS = [
  { label: '80Hz', sub: 'Bass' },
  { label: '250Hz', sub: 'Low Mid' },
  { label: '1kHz', sub: 'Mid' },
  { label: '4kHz', sub: 'High Mid' },
  { label: '12kHz', sub: 'Treble' },
];

export const EqualizerControls: React.FC<EqualizerControlsProps> = ({ onClose }) => {
  const [gains, setGains] = useState<number[]>([0, 0, 0, 0, 0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleGainChange = (index: number, value: number[]) => {
    const newGains = [...gains];
    newGains[index] = value[0];
    setGains(newGains);
    playbackEngine.setEQBand(index, value[0]);
  };

  const resetEQ = () => {
    const flat = [0, 0, 0, 0, 0];
    setGains(flat);
    flat.forEach((g, i) => playbackEngine.setEQBand(i, g));
  };

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
    <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl backdrop-blur-xl">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <span className="h-6 w-2 rounded-full bg-purple-500" />
          Parametric Equalizer
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={resetEQ} className="text-xs">
            Reset
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
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
