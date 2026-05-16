import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { useLowPowerMode } from '@/hooks/useLowPowerMode';

interface AudioVisualizerProps {
  className?: string;
  mode?: 'spectrum' | 'oscilloscope' | 'circular' | 'particles' | 'hybrid';
  color?: string;
  background?: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  className,
  mode = 'spectrum',
  color = '#8B5CF6',
  background = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lowPowerMode = useLowPowerMode();
  const animationRef = useRef<number>();
  const [isVisible, setIsVisible] = useState(true);

  // Background Visibility Management
  useEffect(() => {
    const handleVisibility = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = playbackEngine.getAnalyser();
    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    // State for particles and peaks
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      hue: number;
    }
    let particles: Particle[] = [];
    let lastBeat = 0;
    let rollingEnergy = 0;
    const peaks = new Float32Array(bufferLength).fill(0);

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      if (lowPowerMode) {
        return;
      }

      if (background) ctx.globalAlpha = 0.3;

      if (mode === 'spectrum') {
        analyser.getByteFrequencyData(freqData);
        // Logarithmic scale mapping
        const barCount = 64;
        const barWidth = width / barCount;
        for (let i = 0; i < barCount; i++) {
          // Logarithmic index mapping
          const logIdx = Math.floor(Math.pow(bufferLength, i / barCount));
          const value = freqData[logIdx];
          const barHeight = (value / 255) * height;

          const hue = (i / barCount) * 280;
          ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.8)`;
          ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);

          if (barHeight > peaks[i]) peaks[i] = barHeight;
          else peaks[i] *= 0.95; // Decay factor

          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(i * barWidth, height - peaks[i] - 2, barWidth - 1, 2);
        }
      } else if (mode === 'oscilloscope') {
        analyser.getByteTimeDomainData(timeData);
        ctx.lineWidth = 4;
        ctx.strokeStyle = color;
        // Glow pass
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (mode === 'circular') {
        analyser.getByteFrequencyData(freqData);
        const centerX = width / 2;
        const centerY = height / 2;
        const innerRadius = Math.min(width, height) * 0.25;

        // Album art center fill (simulated with a circle here, handled by UI overlay in reality)
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(Date.now() * 0.0005);

        for (let i = 0; i < 120; i++) {
          const angle = (i / 120) * Math.PI * 2;
          const logIdx = Math.floor(Math.pow(bufferLength, i / 120));
          const value = freqData[logIdx] / 255;
          const barLen = value * innerRadius;

          ctx.strokeStyle = `hsla(${(i / 120) * 360}, 70%, 55%, 0.8)`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
          ctx.lineTo(Math.cos(angle) * (innerRadius + barLen), Math.sin(angle) * (innerRadius + barLen));
          ctx.stroke();
        }
        ctx.restore();
      } else if (mode === 'particles') {
        analyser.getByteFrequencyData(freqData);
        // Bass onset detection (20-150Hz)
        const bassEnd = Math.floor(150 / (playbackEngine.ctx.sampleRate / bufferLength));
        let bassSum = 0;
        for (let i = 0; i < bassEnd; i++) bassSum += freqData[i];
        const currentBass = bassSum / bassEnd;

        rollingEnergy = rollingEnergy * 0.9 + currentBass * 0.1;
        if (currentBass > rollingEnergy * 1.3 && currentBass > 100 && Date.now() - lastBeat > 100) {
          lastBeat = Date.now();
          const count = Math.min(20, 200 - particles.length);
          for (let i = 0; i < count; i++) {
            particles.push({
              x: width / 2,
              y: height / 2,
              vx: (Math.random() - 0.5) * 15,
              vy: (Math.random() - 0.5) * 15,
              life: 1.0,
              maxLife: 1.0,
              hue: Math.random() * 360,
            });
          }
        }

        particles = particles.filter((p) => p.life > 0);
        ctx.globalCompositeOperation = 'lighter';
        particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.97;
          p.vy *= 0.97;
          p.life -= 0.01;
          ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
      } else if (mode === 'hybrid') {
        analyser.getByteTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);

        // Horizontal separator
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Top: Waveform
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * height) / 4;
          if (i === 0) ctx.moveTo(i * sliceWidth, y);
          else ctx.lineTo(i * sliceWidth, y);
        }
        ctx.stroke();

        // Bottom: Bars flipped
        const barsCount = bufferLength / 4;
        const barWidth = width / barsCount;
        for (let i = 0; i < barsCount; i++) {
          const value = freqData[i];
          const barHeight = (value / 255) * (height / 2);
          ctx.fillStyle = `hsla(${(i / barsCount) * 280}, 70%, 55%, 0.6)`;
          ctx.fillRect(i * barWidth, height, barWidth - 1, -barHeight);
        }
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [mode, isVisible, color, lowPowerMode]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('pointer-events-none h-full w-full', className)}
      width={1000}
      height={600}
    />
  );
};
