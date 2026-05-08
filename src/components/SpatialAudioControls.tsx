import React, { useState, useEffect, useRef } from 'react';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';

const SpatialAudioControls: React.FC = () => {
    const [enabled, setEnabled] = useState(playbackEngine.isSpatialAudioEnabled());
    const [headTracking, setHeadTracking] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0, z: 5 });
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const toggleSpatial = (val: boolean) => {
        setEnabled(val);
        playbackEngine.setSpatialAudioEnabled(val);
    };

    const updatePosition = (x: number, z: number) => {
        setPos(prev => {
            const next = { ...prev, x, z };
            playbackEngine.setSpatialPosition(next.x, next.y, next.z);
            return next;
        });
    };

    const updateElevation = (y: number) => {
        setPos(prev => {
            const next = { ...prev, y };
            playbackEngine.setSpatialPosition(next.x, next.y, next.z);
            return next;
        });
    };

    useEffect(() => {
        if (!headTracking) return;

        const handleOrientation = (event: DeviceOrientationEvent) => {
            if (event.alpha === null || event.beta === null || event.gamma === null) return;

            // Simplified Euler to forward/up vector conversion
            const alpha = event.alpha * Math.PI / 180;
            const beta = event.beta * Math.PI / 180;
            const gamma = event.gamma * Math.PI / 180;

            const forward = {
                x: -Math.sin(alpha) * Math.cos(beta),
                y: Math.sin(beta),
                z: -Math.cos(alpha) * Math.cos(beta)
            };

            const up = {
                x: 0,
                y: 1,
                z: 0
            };

            playbackEngine.updateListenerOrientation(forward, up);
        };

        if ((window as any).DeviceOrientationEvent && (window as any).DeviceOrientationEvent.requestPermission) {
            (window as any).DeviceOrientationEvent.requestPermission();
        }

        window.addEventListener('deviceorientation', handleOrientation);
        return () => window.removeEventListener('deviceorientation', handleOrientation);
    }, [headTracking]);

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
        <Card className="p-4 space-y-4 bg-black/40 border-white/10">
            <div className="flex items-center justify-between">
                <Label htmlFor="spatial-toggle">Spatial Audio (HRTF)</Label>
                <Switch id="spatial-toggle" checked={enabled} onCheckedChange={toggleSpatial} />
            </div>

            {enabled && (
                <>
                    <div className="space-y-2">
                        <Label>Position (X, Z)</Label>
                        <canvas
                            ref={canvasRef}
                            width={200}
                            height={200}
                            className="bg-black/60 rounded-lg cursor-crosshair mx-auto border border-white/5"
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
                        <Switch id="head-tracking" checked={headTracking} onCheckedChange={setHeadTracking} />
                    </div>
                </>
            )}
        </Card>
    );
};

export default SpatialAudioControls;
