import React, { useEffect, useRef, useState, useMemo } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn } from '@/lib/utils';
import { useLowPowerMode } from '@/hooks/useLowPowerMode';

interface WaveformSeekBarProps {
  trackId?: string;
  className?: string;
}

export const WaveformSeekBar: React.FC<WaveformSeekBarProps> = ({ className }) => {
  const { currentTime, duration, currentFile, playbackEngine: pe } = usePlayerStore();
  const isStream =
    (currentFile?.file ?? '').includes('stream') || !duration || duration === Infinity;
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [localABLoop, setLocalABLoop] = useState({
    pointA: null as number | null,
    pointB: null as number | null,
    isActive: false,
  });

  const [chapters, setChapters] = useState<{ time: number; title: string }[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const lowPowerMode = useLowPowerMode();

  const peaks = useMemo(() => {
    if (!currentFile?.waveform_data) return null;
    try {
      const allPeaks = JSON.parse(currentFile.waveform_data) as number[];
      const targetCount = lowPowerMode ? 250 : 300;

      // Resample to targetCount
      const resampled: number[] = [];
      for (let i = 0; i < targetCount; i++) {
        const idx = Math.floor((i / targetCount) * allPeaks.length);
        resampled.push(allPeaks[idx]);
      }
      return resampled;
    } catch (e) {
      return null;
    }
  }, [currentFile?.waveform_data, lowPowerMode]);

  useEffect(() => {
    const checkLoop = setInterval(() => {
      const engineAbLoop = pe.abLoop;
      if (engineAbLoop) {
        setLocalABLoop({
          pointA: engineAbLoop.pointA,
          pointB: engineAbLoop.pointB,
          isActive: engineAbLoop.isActive,
        });
      }
    }, 100);
    return () => clearInterval(checkLoop);
  }, [pe]);

  useEffect(() => {
    if (currentFile?.metadata_json) {
      try {
        const metadata = JSON.parse(currentFile.metadata_json);
        if (metadata.chapters) {
          setChapters(metadata.chapters);
        } else if (metadata.chapter_data) {
          setChapters(JSON.parse(metadata.chapter_data));
        } else {
          setChapters([]);
        }
      } catch (e) {
        setChapters([]);
      }
    } else {
      setChapters([]);
    }
  }, [currentFile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case '[':
          pe.abLoop.setA(currentTime);
          break;
        case ']':
          pe.abLoop.setB(currentTime);
          break;
        case '\\':
          pe.abLoop.toggle();
          break;
        case 'ArrowLeft':
          pe.resume();
          pe.seek(Math.max(0, currentTime - (e.shiftKey ? 30 : 5)));
          break;
        case 'ArrowRight':
          pe.resume();
          pe.seek(Math.min(duration, currentTime + (e.shiftKey ? 30 : 5)));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, pe]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragMarker, setDragMarker] = useState<'progress' | 'A' | 'B' | null>(null);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.type === 'mousedown' && (e as React.MouseEvent).button !== 0) return;
    if (!containerRef.current || isStream) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const position = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    const targetTime = position * duration;

    // Check if clicking near A or B markers
    const clickThreshold = 0.02; // 2% of width
    const progressPos = currentTime / duration;
    const aPos = localABLoop.pointA !== null ? localABLoop.pointA / duration : -1;
    const bPos = localABLoop.pointB !== null ? localABLoop.pointB / duration : -1;

    if (Math.abs(position - aPos) < clickThreshold) {
      setDragMarker('A');
    } else if (Math.abs(position - bPos) < clickThreshold) {
      setDragMarker('B');
    } else {
      setDragMarker('progress');
      pe.seek(targetTime);
    }
    setIsDragging(true);
  };

  const lastPreviewTime = useRef(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const position = Math.max(0, Math.min(1, x / rect.width));
    const targetTime = position * duration;
    setHoverTime(targetTime);

    if (isDragging && dragMarker) {
      if (dragMarker === 'A') {
        pe.abLoop.setA(targetTime);
      } else if (dragMarker === 'B') {
        pe.abLoop.setB(targetTime);
      } else if (dragMarker === 'progress') {
        const now = Date.now();
        if (now - lastPreviewTime.current > 300) {
          pe.preview(targetTime);
          lastPreviewTime.current = now;
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMarker(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const hoverProgress = hoverTime !== null && duration > 0 ? hoverTime / duration : null;

  const renderWaveform = () => {
    if (!peaks) {
      return (
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute left-0 top-0 h-full bg-purple-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      );
    }

    const width = 1000;
    const height = 64;
    const barWidth = width / peaks.length;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full">
        {peaks.map((peak, i) => {
          const x = i * barWidth;
          const barHeight = peak * height * 0.8;
          const barProgress = i / peaks.length;
          const isPlayed = barProgress <= progress;
          const isHovered = hoverProgress !== null && barProgress <= hoverProgress;

          let color = 'rgba(139, 92, 246, 0.2)';
          if (isPlayed) color = '#8B5CF6';
          else if (isHovered) color = 'rgba(139, 92, 246, 0.4)';

          return (
            <rect
              key={i}
              x={x}
              y={(height - barHeight) / 2}
              width={barWidth - 1}
              height={barHeight}
              fill={color}
              rx={1}
            />
          );
        })}

        {/* A/B Loop Shading */}
        {localABLoop.pointA !== null && localABLoop.pointB !== null && (
          <rect
            x={(localABLoop.pointA / duration) * width}
            y={0}
            width={((localABLoop.pointB - localABLoop.pointA) / duration) * width}
            height={height}
            fill="rgba(0, 255, 255, 0.12)"
          />
        )}

        {/* Chapter Markers */}
        {chapters.map((chapter, i) => (
          <rect
            key={i}
            x={(chapter.time / duration) * width - 0.5}
            y={0}
            width={1}
            height={height}
            fill="rgba(255, 255, 255, 0.3)"
          />
        ))}
      </svg>
    );
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>{formatTime(currentTime)}</span>
        <div className="flex items-center gap-2">
          {isStream && (
            <div className="flex animate-pulse items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-500">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
              LIVE
            </div>
          )}
          <span className="font-bold text-foreground">
            {hoverTime !== null ? formatTime(hoverTime) : ''}
          </span>
        </div>
        <span>{isStream ? '--:--' : formatTime(duration)}</span>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'group relative h-16 w-full select-none',
          isStream ? 'cursor-default' : 'cursor-pointer',
        )}
        onMouseDown={handleInteraction}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoverTime(null);
          handleMouseUp();
        }}
      >
        {renderWaveform()}

        {/* Scrubber Handle */}
        {!isStream && (
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-10 w-1 bg-white shadow-lg transition-all duration-75"
            style={{ left: `${(currentTime / duration) * 100}%`, transform: 'translateX(-50%)' }}
          />
        )}

        {/* A/B Markers (Draggable SVG Overlays) */}
        {localABLoop.pointA !== null && (
          <div
            className="group/markerA absolute -top-1 z-20 flex h-full w-6 cursor-ew-resize justify-center"
            style={{
              left: `${(localABLoop.pointA / duration) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-[#00FFFF] drop-shadow-sm" />
            <div className="absolute bottom-0 top-0 w-[2px] bg-[#00FFFF] opacity-40 group-hover/markerA:opacity-100" />
          </div>
        )}
        {localABLoop.pointB !== null && (
          <div
            className="group/markerB absolute -top-1 z-20 flex h-full w-6 cursor-ew-resize justify-center"
            style={{
              left: `${(localABLoop.pointB / duration) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-[#FF8C00] drop-shadow-sm" />
            <div className="absolute bottom-0 top-0 w-[2px] bg-[#FF8C00] opacity-40 group-hover/markerB:opacity-100" />
          </div>
        )}
      </div>
    </div>
  );
};
