import React, { useState, useEffect, useRef } from 'react';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { VolumeX, Volume2, Maximize2 } from 'lucide-react';
import { API_BASE } from '@/lib/utils';

const SpatialAudioControls: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [headTracking, setHeadTracking] = useState(false);
  const [monoMerge, setMonoMerge] = useState(false);
  const [stereoWidth, setStereoWidth] = useState(1.0);
  const [pos, setPos] = useState({ x: 0, y: 0, z: 5 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const persistSettings = (e: boolean, h: boolean, m: boolean, w: number, p: typeof pos) => {
    const settings = { enabled: e, headTracking: h, monoMerge: m, stereoWidth: w, pos: p };
    localStorage.setItem('ZOVYRA_spatial_settings', JSON.stringify(settings));
    fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'spatial_settings', value: JSON.stringify(settings) }),
    }).catch(console.error);
  };

  const toggleSpatial = (val: boolean) => {
    setEnabled(val);
    playbackEngine.setSpatialAudioEnabled(val);
    persistSettings(val, headTracking, monoMerge, stereoWidth, pos);
  };

  const toggleMonoMerge = (val: boolean) => {
    setMonoMerge(val);
    playbackEngine.setSpatialMonoMerge(val);
    persistSettings(enabled, headTracking, val, stereoWidth, pos);
  };

  const updateStereoWidth = (val: number) => {
    setStereoWidth(val);
    playbackEngine.setStereoWidth(val);
    persistSettings(enabled, headTracking, monoMerge, val, pos);
  };

  const updatePosition = (x: number, z: number) => {
    const next = { ...pos, x, z };
    setPos(next);
    playbackEngine.setSpatialPosition(next.x, next.y, next.z);
    persistSettings(enabled, headTracking, monoMerge, stereoWidth, next);
  };

  const updateElevation = (y: number) => {
    const next = { ...pos, y };
    setPos(next);
    playbackEngine.setSpatialPosition(next.x, next.y, next.z);
    persistSettings(enabled, headTracking, monoMerge, stereoWidth, next);
  };

  useEffect(() => {
    if (!headTracking) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha === null || event.beta === null || event.gamma === null) return;

      // Simplified Euler to forward/up vector conversion
      const alpha = (event.alpha * Math.PI) / 180;
      const beta = (event.beta * Math.PI) / 180;
      const gamma = (event.gamma * Math.PI) / 180;

      const forward = {
        x: -Math.sin(alpha) * Math.cos(beta),
        y: Math.sin(beta),
        z: -Math.cos(alpha) * Math.cos(beta),
      };

      const up = {
        x: 0,
        y: 1,
        z: 0,
      };

      playbackEngine.updateListenerOrientation(forward, up);
    };

    const DeviceOrientation = window.DeviceOrientationEvent;
    if (DeviceOrientation && 'requestPermission' in DeviceOrientation) {
      void (
        DeviceOrientation as typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<PermissionState>;
        }
      ).requestPermission?.();
    }

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [headTracking]);

  useEffect(() => {
    const saved = localStorage.getItem('ZOVYRA_spatial_settings');
    if (saved) {
      const s = JSON.parse(saved);
      setEnabled(s.enabled);
      setHeadTracking(s.headTracking);
      setMonoMerge(s.monoMerge || false);
      setStereoWidth(s.stereoWidth ?? 1.0);
      setPos(s.pos);

      playbackEngine.setSpatialAudioEnabled(s.enabled);
      playbackEngine.setSpatialMonoMerge(s.monoMerge || false);
      playbackEngine.setStereoWidth(s.stereoWidth ?? 1.0);
      playbackEngine.setSpatialPosition(s.pos.x, s.pos.y, s.pos.z);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw listener (center)
      ctx.fillStyle = '#1DB954';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw source
      const sourceX = (pos.x / 10 + 0.5) * canvas.width;
      const sourceZ = (pos.z / 10 + 0.5) * canvas.height;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sourceX, sourceZ, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, canvas.height / 2);
      ctx.lineTo(sourceX, sourceZ);
      ctx.stroke();
    };

    draw();
  }, [pos]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    const z = ((e.clientY - rect.top) / rect.height - 0.5) * 10;
    updatePosition(x, z);
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 border-white/10 bg-black/40 p-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="spatial-toggle">Spatial Audio (HRTF)</Label>
          <Switch id="spatial-toggle" checked={enabled} onCheckedChange={toggleSpatial} />
        </div>

        {enabled && (
          <>
            <div className="flex items-center justify-between">
              <Label htmlFor="mono-merge">Stereo-to-Mono Merge</Label>
              <Switch id="mono-merge" checked={monoMerge} onCheckedChange={toggleMonoMerge} />
            </div>

            <div className="space-y-2">
              <Label>Position (X, Z)</Label>
              <canvas
                ref={canvasRef}
                width={200}
                height={200}
                className="mx-auto cursor-crosshair rounded-lg border border-white/5 bg-black/60"
                onClick={handleCanvasClick}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Elevation (Y)</Label>
                <span>{pos.y.toFixed(1)}</span>
              </div>
              <Slider
                value={[pos.y]}
                min={-5}
                max={5}
                step={0.1}
                onValueChange={([val]) => updateElevation(val)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="head-tracking">Head Tracking</Label>
              <Switch id="head-tracking" checked={headTracking} onCheckedChange={(val) => {
                setHeadTracking(val);
                persistSettings(enabled, val, monoMerge, stereoWidth, pos);
              }} />
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-4 border-white/10 bg-black/40 p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Maximize2 className="h-4 w-4 text-purple-400" />
              <Label>Stereo Widening</Label>
            </div>
            <div className="flex items-center gap-1 font-mono text-xs">
              {stereoWidth > 1.2 && (
                <div className="group relative">
                  <VolumeX className="h-3 w-3 text-amber-500 cursor-help" />
                  <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded bg-black px-2 py-1 text-[10px] text-white group-hover:block w-32 text-center border border-white/10">
                    Mono compatibility warning: excessive side gain
                  </div>
                </div>
              )}
              {Math.round(stereoWidth * 100)}%
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Volume2 className="h-4 w-4 text-gray-500" />
            <Slider
              value={[stereoWidth]}
              min={0}
              max={2}
              step={0.01}
              onValueChange={([val]) => updateStereoWidth(val)}
            />
            <Maximize2 className="h-4 w-4 text-gray-500" />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SpatialAudioControls;
