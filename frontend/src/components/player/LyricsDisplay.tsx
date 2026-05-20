import React, { useEffect, useRef, useState } from 'react';
import { LyricLine, LyricsService } from '@/lib/LyricsService';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface LyricsDisplayProps {
  trackId?: string;
  artist: string;
  title: string;
  currentTime: number;
  className?: string;
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  trackId,
  artist,
  title,
  currentTime,
  className,
}) => {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isKaraokeMode, setIsKaraokeMode] = useState(true);

  const handleLineClick = (time: number) => {
    // In a real app we'd use the playback engine to seek
    window.dispatchEvent(new CustomEvent('zovyra-seek', { detail: time }));
  };
  const [showTranslation, setShowTranslation] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLyrics = async () => {
      if (!trackId) {
        setLyrics([]);
        return;
      }
      const data = await LyricsService.getLyrics(trackId);
      if (data) {
        setLyrics(data);
      } else {
        setLyrics([]);
      }
    };
    fetchLyrics();
  }, [trackId]);

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
    <div className="relative h-full overflow-hidden">
      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTranslation(!showTranslation)}
          className={cn(showTranslation && 'text-primary')}
        >
          🌐
        </Button>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'no-scrollbar h-full overflow-y-auto scroll-smooth px-4 py-[40vh]',
          className,
        )}
      >
        <div className="space-y-12">
          {lyrics.map((line, i) => {
            const distance = Math.abs(i - activeIndex);
            const isActive = i === activeIndex;

            return (
              <div
                key={i}
                data-index={i}
                className={cn(
                  'cursor-pointer select-none text-center transition-all duration-500',
                  isActive
                    ? 'scale-110 text-3xl font-bold text-white opacity-100'
                    : distance === 1
                      ? 'text-2xl font-semibold text-zinc-400 opacity-70'
                      : 'text-xl font-medium text-zinc-600 opacity-40',
                )}
                onClick={() => handleLineClick(line.time)}
                onDoubleClick={() => {
                  if (isActive) setIsKaraokeMode(!isKaraokeMode);
                }}
              >
                <div className="relative inline-block">
                  {isKaraokeMode && line.words ? (
                    <div className="flex flex-wrap justify-center gap-x-2">
                      {line.words.map((word, wi) => {
                        const isWordActive = currentTime >= word.time;
                        return (
                          <span
                            key={wi}
                            className={cn(
                              'transition-colors duration-300',
                              isWordActive ? 'text-white' : 'text-zinc-500',
                            )}
                            style={{
                              textShadow: isWordActive ? '0 0 10px rgba(255,255,255,0.5)' : 'none',
                            }}
                          >
                            {word.text}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    line.text
                  )}
                  {showTranslation && line.text && (
                    <p className="mt-2 text-sm font-normal italic opacity-60">
                      Translation coming soon...
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
