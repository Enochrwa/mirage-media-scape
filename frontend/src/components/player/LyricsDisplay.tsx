import React, { useEffect, useRef, useState } from 'react';
import { LyricLine, LyricsService } from '@/lib/LyricsService';
import { cn } from '@/lib/utils';

interface LyricsDisplayProps {
  artist: string;
  title: string;
  currentTime: number;
  className?: string;
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  artist,
  title,
  currentTime,
  className,
}) => {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLyrics = async () => {
      const data = await LyricsService.getLyrics(artist, title);
      if (data) {
        setLyrics(data);
      } else {
        setLyrics([]);
      }
    };
    fetchLyrics();
  }, [artist, title]);

  useEffect(() => {
    // Binary search for active lyric index
    let low = 0;
    let high = lyrics.length - 1;
    let index = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lyrics[mid].time <= currentTime) {
        index = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (index !== -1 && index !== activeIndex) {
      setActiveIndex(index);

      // Auto-scroll
      const activeElement = containerRef.current?.querySelector(`[data-index="${index}"]`);
      activeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime, lyrics, activeIndex]);

  if (lyrics.length === 0) {
    return (
      <div className={cn('flex items-center justify-center italic text-zinc-500', className)}>
        No synced lyrics found
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('space-y-6 overflow-y-auto px-4 py-32', className)}>
      {lyrics.map((line, i) => (
        <div
          key={i}
          data-index={i}
          className={cn(
            'cursor-pointer text-2xl font-bold transition-all duration-500 hover:text-white',
            i === activeIndex
              ? 'origin-left scale-110 text-white opacity-100'
              : 'text-zinc-600 opacity-40 hover:opacity-100',
          )}
          onClick={() => {
            // Logic to seek could go here if needed, via context
          }}
        >
          {line.words ? (
            line.words.map((word, wi) => {
              const isWordActive = currentTime >= word.time;
              return (
                <span
                  key={wi}
                  className={cn(
                    'mr-2 transition-colors duration-200',
                    isWordActive ? 'text-white' : 'text-zinc-600'
                  )}
                >
                  {word.text}
                </span>
              );
            })
          ) : (
            line.text
          )}
        </div>
      ))}
    </div>
  );
};
