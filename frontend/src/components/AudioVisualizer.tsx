import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { useLowPowerMode } from '@/hooks/useLowPowerMode';

interface AudioVisualizerProps {
  className?: string;
  mode?: 'spectrum' | 'oscilloscope' | 'circular' | 'particles' | 'hybrid';
  color?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  className,
  mode = 'spectrum',
  color = '#8B5CF6',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lowPowerMode = useLowPowerMode();
  const animationRef = useRef<number>();
  const [isVisible, setIsVisible] = useState(true);

  // Background Visibility Management
  useEffect(() => {
    const handleVisibility = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsVisible(customEvent.detail === 'visible');
    };
    window.addEventListener('zovyra-visibility-change', handleVisibility);
    return () => window.removeEventListener('zovyra-visibility-change', handleVisibility);
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

      if (mode === 'spectrum') {
        analyser.getByteFrequencyData(freqData);
        const barWidth = (width / (bufferLength / 2)) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength / 2; i++) {
          const value = freqData[i];
          const barHeight = (value / 255) * height;

          // Logarithmic-ish color
          const hue = (i / (bufferLength / 2)) * 280;
          ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.8)`;
          ctx.fillRect(x, height - barHeight, barWidth, barHeight);

          // Peaks with gravity
          if (barHeight > peaks[i]) {
            peaks[i] = barHeight;
          } else {
            peaks[i] -= 2;
          }
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(x + barWidth / 2, height - peaks[i] - 2, 1, 0, Math.PI * 2);
          ctx.fill();

          // Reflection
          ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.2)`;
          ctx.fillRect(x, height, barWidth, barHeight * 0.3);

          x += barWidth + 1;
        }
      } else if (mode === 'oscilloscope') {
        analyser.getByteTimeDomainData(timeData);
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) ctx.moveTo(x, y);
          else {
            // Smooth curves
            const nextX = x + sliceWidth;
            const nextV = timeData[i+1] / 128.0 || 1;
            const nextY = (nextV * height) / 2;
            const cpX = (x + nextX) / 2;
            ctx.quadraticCurveTo(x, y, cpX, (y + nextY) / 2);
          }
          x += sliceWidth;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (mode === 'circular') {
        analyser.getByteFrequencyData(freqData);
        const centerX = width / 2;
        const centerY = height / 2;
        const innerRadius = Math.min(width, height) * 0.25;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(Date.now() * 0.0002); // Slow rotation

        for (let i = 0; i < bufferLength / 2; i += 2) {
          const angle = (i / (bufferLength / 2)) * Math.PI * 2;
          const value = freqData[i] / 255;
          const barLen = value * innerRadius * 1.2;

          const x1 = Math.cos(angle) * innerRadius;
          const y1 = Math.sin(angle) * innerRadius;
          const x2 = Math.cos(angle) * (innerRadius + barLen);
          const y2 = Math.sin(angle) * (innerRadius + barLen);

          ctx.strokeStyle = `hsla(${(i / (bufferLength / 2)) * 360}, 70%, 55%, 0.8)`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();

        // Inner circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (mode === 'particles') {
        analyser.getByteFrequencyData(freqData);
        // Bass energy (bins < 300Hz)
        const bassBins = Math.floor(300 / (playbackEngine.ctx.sampleRate / bufferLength));
        const energy = freqData.slice(0, bassBins).reduce((a, b) => a + b, 0) / bassBins;
        rollingEnergy = rollingEnergy * 0.95 + energy * 0.05;

        if (energy > rollingEnergy * 1.5 && energy > 140 && Date.now() - lastBeat > 150) {
          lastBeat = Date.now();
          for (let i = 0; i < 40; i++) {
            particles.push({
              x: width / 2,
              y: height / 2,
              vx: (Math.random() - 0.5) * 12,
              vy: (Math.random() - 0.5) * 12,
              life: 1.0,
              maxLife: 1.0,
              hue: Math.random() * 360
            });
          }
        }

        particles = particles.filter(p => p.life > 0);
        ctx.globalCompositeOperation = 'lighter';
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.96;
          p.vy *= 0.96;
          p.life -= 0.015;

          const alpha = Math.pow(p.life / p.maxLife, 2);
          ctx.fillStyle = `hsla(${p.hue}, 70%, 55%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4 * p.life, 0, Math.PI * 2);
          ctx.fill();

          // Connecting lines
          particles.forEach(other => {
            const dx = p.x - other.x;
            const dy = p.y - other.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 60) {
              ctx.strokeStyle = `hsla(${p.hue}, 70%, 55%, ${alpha * 0.2})`;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(other.x, other.y);
              ctx.stroke();
            }
          });
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
        const barWidth = (width / barsCount);
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
      className={cn("w-full h-full pointer-events-none", className)}
      width={1000}
      height={600}
    />
  );
};
