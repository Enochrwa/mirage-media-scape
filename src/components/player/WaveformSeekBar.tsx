import React, { useEffect, useRef, useState } from 'react';
import { useMedia } from '@/contexts/MediaContext';

interface WaveformSeekBarProps {
  trackId: string;
  className?: string;
}

const WaveformSeekBar: React.FC<WaveformSeekBarProps> = ({ trackId, className }) => {
  const { currentTime, duration, seekTo } = useMedia();
  const [peaks, setPeaks] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchWaveform = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/tracks/${trackId}/waveform`);
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

      const isPlayed = (i / peaks.length) < progress;
      ctx.fillStyle = isPlayed ? '#8B5CF6' : '#4B5563'; // purple-500 : gray-600

      ctx.fillRect(x, midY - barHeight / 2, barWidth - 1, barHeight);
    });
  }, [peaks, currentTime, duration]);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const position = (x - rect.left) / rect.width;
    seekTo(position * duration);
  };

  return (
    <div
      ref={containerRef}
      className={`relative h-12 w-full cursor-pointer group ${className}`}
      onMouseDown={handleInteraction}
      onTouchStart={handleInteraction}
    >
      <canvas
        ref={canvasRef}
        width={1000}
        height={64}
        className="w-full h-full"
      />
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-100"
        style={{ left: `${(currentTime / duration) * 100}%` }}
      />
    </div>
  );
};

export default WaveformSeekBar;
