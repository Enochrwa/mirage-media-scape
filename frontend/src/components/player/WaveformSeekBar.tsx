import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { API_BASE } from '@/lib/utils';

interface WaveformSeekBarProps {
  trackId: string;
  className?: string;
}

const WaveformSeekBar: React.FC<WaveformSeekBarProps> = ({ trackId, className }) => {
  const { currentTime, duration, seekTo, playbackEngine } = usePlayerStore();
  const [peaks, setPeaks] = useState<number[]>([]);
  const [abLoop, setABLoop] = useState({
    pointA: null as number | null,
    pointB: null as number | null,
    isActive: false,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkLoop = setInterval(() => {
      if (playbackEngine?.abLoop) {
        const state = {
          pointA: playbackEngine.abLoop.pointA,
          pointB: playbackEngine.abLoop.pointB,
          isActive: playbackEngine.abLoop.isActive,
        };
        setABLoop(state);
      }
    }, 100);
    return () => clearInterval(checkLoop);
  }, [playbackEngine]);

  useEffect(() => {
    const fetchWaveform = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/tracks/${trackId}/waveform`);
        const data = await response.json();
        if (data.peaks) {
          setPeaks(data.peaks);
        }
      } catch (error) {
        console.error('Failed to fetch waveform:', error);
      }
    };

    fetchWaveform();
  }, [trackId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const midY = height / 2;
    const progress = currentTime / duration;

    ctx.clearRect(0, 0, width, height);

    peaks.forEach((peak, i) => {
      const x = (i / peaks.length) * width;
      const barWidth = width / peaks.length;
      const barHeight = peak * height * 0.8;

      const isPlayed = i / peaks.length < progress;
      ctx.fillStyle = isPlayed ? '#8B5CF6' : '#4B5563';

      ctx.fillRect(x, midY - barHeight / 2, barWidth - 1, barHeight);
    });

    // Draw A-B loop area
    if (abLoop.pointA !== null && abLoop.pointB !== null) {
      const xA = (abLoop.pointA / duration) * width;
      const xB = (abLoop.pointB / duration) * width;
      ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
      ctx.fillRect(xA, 0, xB - xA, height);
    }
  }, [peaks, currentTime, duration, abLoop]);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const position = (x - rect.left) / rect.width;
    seekTo(position * duration);
  };

  return (
    <div
      ref={containerRef}
      className={`group relative h-12 w-full cursor-pointer ${className}`}
      onMouseDown={handleInteraction}
      onTouchStart={handleInteraction}
    >
      <canvas ref={canvasRef} width={1000} height={64} className="h-full w-full" />
      <div
        className="absolute bottom-0 top-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-100"
        style={{ left: `${(currentTime / duration) * 100}%` }}
      />

      {abLoop.pointA !== null && (
        <div
          className="absolute bottom-0 top-0 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-cyan-400"
          style={{ left: `${(abLoop.pointA / duration) * 100}%`, transform: 'translateX(-50%)' }}
        />
      )}
      {abLoop.pointB !== null && (
        <div
          className="absolute bottom-0 top-0 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-orange-400"
          style={{ left: `${(abLoop.pointB / duration) * 100}%`, transform: 'translateX(-50%)' }}
        />
      )}
    </div>
  );
};

export default WaveformSeekBar;
