import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { playbackEngine } from '@/lib/PlaybackEngine';

interface AudioVisualizerProps {
  className?: string;
  isPlaying: boolean;
  intensity?: number;
  colorScheme?: 'default' | 'neon' | 'fire' | 'ocean' | 'galaxy' | 'matrix' | 'rainbow';
  visualizerType?:
    | 'bars'
    | 'wave'
    | 'circle'
    | 'spectrum'
    | 'orbit'
    | 'dna'
    | 'particle'
    | 'liquid';
  showControls?: boolean;
  responsive?: boolean;
}

const allVisualizerTypes = [
  'bars',
  'wave',
  'circle',
  'spectrum',
  'orbit',
  'dna',
  'particle',
  'liquid',
] as const;
type VisualizerType = (typeof allVisualizerTypes)[number];

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  className,
  isPlaying,
  intensity = 0.7,
  colorScheme = 'default',
  visualizerType = 'bars',
  showControls = true,
  responsive = true,
}) => {
  const [currentType, setCurrentType] = useState<VisualizerType>(visualizerType);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const colorSchemes = {
    default: ['#8B5CF6', '#06B6D4', '#10B981'],
    neon: ['#FF0080', '#00FF80', '#8000FF', '#FF8000'],
    fire: ['#FF4500', '#FF6347', '#FFD700', '#FF8C00'],
    ocean: ['#0080FF', '#00BFFF', '#1E90FF', '#4169E1'],
    galaxy: ['#9932CC', '#8A2BE2', '#4B0082', '#6A5ACD'],
    matrix: ['#00FF00', '#32CD32', '#7FFF00', '#ADFF2F'],
    rainbow: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'],
  };

  const getColors = () => colorSchemes[colorScheme] ?? colorSchemes.default;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = (analyserRef.current = playbackEngine.getAnalyser());
    const bufferLength = analyser.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength) as any;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      if (isPlaying && analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const colors = getColors();

        if (currentType === 'bars' || currentType === 'spectrum') {
          const barWidth = (width / bufferLength) * 2.5;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArrayRef.current[i] / 255) * height * intensity;
            const colorIdx = Math.floor((i / bufferLength) * colors.length);
            ctx.fillStyle = colors[colorIdx];
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
          }
        } else if (currentType === 'wave') {
          ctx.lineWidth = 2;
          ctx.strokeStyle = colors[0];
          ctx.beginPath();

          const sliceWidth = width / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArrayRef.current[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
          }
          ctx.stroke();
        } else if (currentType === 'circle') {
          const centerX = width / 2;
          const centerY = height / 2;
          const radius = Math.min(width, height) / 4;

          ctx.beginPath();
          ctx.strokeStyle = colors[0];
          ctx.lineWidth = 2;

          for (let i = 0; i < bufferLength; i++) {
            const angle = (i / bufferLength) * Math.PI * 2;
            const amplitude = (dataArrayRef.current[i] / 255) * radius * intensity;
            const x = centerX + (radius + amplitude) * Math.cos(angle);
            const y = centerY + (radius + amplitude) * Math.sin(angle);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
      } else {
        // Static state when not playing
        ctx.fillStyle = '#1f2937';
        const barWidth = 4;
        for (let i = 0; i < width; i += 8) {
          ctx.fillRect(i, height - 10, barWidth, 10);
        }
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentType, colorScheme, intensity]);

  return (
    <div className={cn('relative h-full w-full select-none overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        width={responsive ? 800 : 400}
        height={responsive ? 400 : 200}
        className="h-full w-full cursor-pointer"
        onClick={() => {
          const idx = allVisualizerTypes.indexOf(currentType as any);
          setCurrentType(allVisualizerTypes[(idx + 1) % allVisualizerTypes.length]);
        }}
      />
      {showControls && (
        <div className="absolute bottom-2 left-2 rounded-full bg-black/20 px-2 py-1 text-[10px] uppercase tracking-tighter text-white/40">
          {currentType} mode
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;
