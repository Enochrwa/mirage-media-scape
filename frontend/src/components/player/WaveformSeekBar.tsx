import React, { useEffect, useRef, useState, useMemo } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn } from '@/lib/utils';

interface WaveformSeekBarProps {
  trackId?: string;
  className?: string;
}

export const WaveformSeekBar: React.FC<WaveformSeekBarProps> = ({ className }) => {
  const { currentTime, duration, playbackEngine, currentFile } = usePlayerStore();
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [abLoop, setABLoop] = useState({
    pointA: null as number | null,
    pointB: null as number | null,
    isActive: false,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const peaks = useMemo(() => {
    if (!currentFile?.waveform_data) return [];
    try {
      return JSON.parse(currentFile.waveform_data) as number[];
    } catch (e) {
      return [];
    }
  }, [currentFile?.waveform_data]);

  useEffect(() => {
    const checkLoop = setInterval(() => {
      if (playbackEngine?.abLoop) {
        setABLoop({
          pointA: playbackEngine.abLoop.pointA,
          pointB: playbackEngine.abLoop.pointB,
          isActive: playbackEngine.abLoop.isActive,
        });
      }
    }, 100);
    return () => clearInterval(checkLoop);
  }, [playbackEngine]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const progress = currentTime / duration;
    const hoverProgress = hoverTime !== null ? hoverTime / duration : null;

    if (peaks.length === 0) {
      // Fallback thin progress bar
      ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
      ctx.fillRect(0, height / 2 - 2, width, 4);
      ctx.fillStyle = '#8B5CF6';
      ctx.fillRect(0, height / 2 - 2, width * progress, 4);
    } else {
      const barWidth = width / peaks.length;
      peaks.forEach((peak, i) => {
        const x = i * barWidth;
        const barHeight = peak * height * 0.8;
        const barProgress = i / peaks.length;

        const isPlayed = barProgress <= progress;
        const isHovered = hoverProgress !== null && barProgress <= hoverProgress;

        if (isPlayed) ctx.fillStyle = '#8B5CF6';
        else if (isHovered) ctx.fillStyle = 'rgba(139, 92, 246, 0.4)';
        else ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';

        ctx.fillRect(x, (height - barHeight) / 2, barWidth - 1, barHeight);
      });
    }

    // A/B Loop Shading
    if (abLoop.pointA !== null && abLoop.pointB !== null) {
      const xA = (abLoop.pointA / duration) * width;
      const xB = (abLoop.pointB / duration) * width;
      ctx.fillStyle = 'rgba(0, 255, 255, 0.12)';
      ctx.fillRect(xA, 0, xB - xA, height);
    }
  }, [peaks, currentTime, duration, hoverTime, abLoop]);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const position = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    playbackEngine.ctx.resume().then(() => {
       // Manual seek logic if needed, but for now we just update time
       // In a real implementation, you'd call playbackEngine.seek(position * duration)
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverTime(Math.max(0, Math.min(1, x / rect.width)) * duration);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-xs font-mono text-muted-foreground">
        <span>{formatTime(currentTime)}</span>
        <span className="text-foreground font-bold">{hoverTime !== null ? formatTime(hoverTime) : ''}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div
        ref={containerRef}
        className="relative h-16 w-full cursor-pointer group"
        onMouseDown={handleInteraction}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverTime(null)}
      >
        <canvas ref={canvasRef} width={1000} height={64} className="h-full w-full" />

        {/* Scrubber Handle */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg transition-all duration-75 pointer-events-none"
          style={{ left: `${(currentTime / duration) * 100}%`, transform: 'translateX(-50%)' }}
        />

        {/* A/B Markers */}
        {abLoop.pointA !== null && (
          <div
            className="absolute -top-1 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-cyan-400"
            style={{ left: `${(abLoop.pointA / duration) * 100}%`, transform: 'translateX(-50%)' }}
          />
        )}
        {abLoop.pointB !== null && (
          <div
            className="absolute -top-1 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-orange-400"
            style={{ left: `${(abLoop.pointB / duration) * 100}%`, transform: 'translateX(-50%)' }}
          />
        )}
      </div>
    </div>
  );
};
