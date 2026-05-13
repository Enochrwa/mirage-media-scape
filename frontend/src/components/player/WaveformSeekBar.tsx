import React, { useEffect, useRef, useState, useMemo } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn } from '@/lib/utils';

interface WaveformSeekBarProps {
  trackId?: string;
  className?: string;
}

export const WaveformSeekBar: React.FC<WaveformSeekBarProps> = ({ className }) => {
   const { currentTime, duration, currentFile, playbackEngine: pe, abLoop: engineABLoop } = usePlayerStore();
   const isStream = (currentFile?.file ?? '').includes('stream') || !duration || duration === Infinity;
   const [hoverTime, setHoverTime] = useState<number | null>(null);
   const [localABLoop, setLocalABLoop] = useState({
     pointA: null as number | null,
     pointB: null as number | null,
     isActive: false,
   });

  const [chapters, setChapters] = useState<{ time: number; title: string }[]>([]);

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
       const { abLoop: engineAbLoop } = usePlayerStore.getState();
       if (engineAbLoop) {
         setLocalABLoop({
           pointA: engineAbLoop.pointA,
           pointB: engineAbLoop.pointB,
           isActive: engineAbLoop.isActive,
         });
       }
     }, 100);
     return () => clearInterval(checkLoop);
   }, []);

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
     if (localABLoop.pointA !== null && localABLoop.pointB !== null) {
       const xA = (localABLoop.pointA / duration) * width;
       const xB = (localABLoop.pointB / duration) * width;
      ctx.fillStyle = 'rgba(0, 255, 255, 0.12)';
      ctx.fillRect(xA, 0, xB - xA, height);
    }

    // Chapter markers
    chapters.forEach((chapter) => {
      const x = (chapter.time / duration) * width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(x - 1, 0, 2, height);
    });
  }, [peaks, currentTime, duration, hoverTime, localABLoop, chapters]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragMarker, setDragMarker] = useState<'progress' | 'A' | 'B' | null>(null);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
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
        className={cn('group relative h-16 w-full', isStream ? 'cursor-default' : 'cursor-pointer')}
        onMouseDown={handleInteraction}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoverTime(null);
          handleMouseUp();
        }}
      >
        <canvas ref={canvasRef} width={1000} height={64} className="h-full w-full" />

        {/* Scrubber Handle */}
        {!isStream && (
          <div
            className="pointer-events-none absolute bottom-0 top-0 w-1 bg-white shadow-lg transition-all duration-75"
            style={{ left: `${(currentTime / duration) * 100}%`, transform: 'translateX(-50%)' }}
          />
        )}

{/* A/B Markers */}
         {localABLoop.pointA !== null && (
           <div
             className="absolute -top-1 z-20 h-0 w-0 cursor-ew-resize border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent"
             style={{
               left: `${(localABLoop.pointA / duration) * 100}%`,
               transform: 'translateX(-50%)',
               borderTopColor: '#00FFFF',
             }}
           />
         )}
         {localABLoop.pointB !== null && (
           <div
             className="absolute -top-1 z-20 h-0 w-0 cursor-ew-resize border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent"
             style={{
               left: `${(localABLoop.pointB / duration) * 100}%`,
               transform: 'translateX(-50%)',
               borderTopColor: '#FF8C00',
             }}
           />
         )}
      </div>
    </div>
  );
};
