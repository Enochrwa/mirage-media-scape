import React from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { Play, Pause, SkipBack, SkipForward, ChevronUp, Volume2, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export const MiniPlayer: React.FC = () => {
  const {
    currentFile,
    isPlaying,
    togglePlayback,
    currentTime,
    duration,
    nextTrack,
    previousTrack,
    setPlayerFullscreen
  } = usePlayerStore();
  const { files } = useLibraryStore();

  if (!currentFile) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-t border-border h-20 px-4">
      <div className="absolute top-0 left-0 right-0">
        <Progress value={(currentTime / duration) * 100} className="h-1 rounded-none bg-primary/20" />
      </div>

      <div className="flex items-center justify-between h-full max-w-7xl mx-auto gap-4">
        <div
          className="flex items-center gap-3 min-w-0 cursor-pointer group"
          onClick={() => setPlayerFullscreen(true)}
        >
          <img
            src={currentFile.cover || '/placeholder.svg'}
            alt={currentFile.title}
            className="h-12 w-12 rounded shadow-lg transition-transform group-hover:scale-105"
          />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold truncate text-foreground leading-tight">
              {currentFile.title}
            </h4>
            <p className="text-xs text-muted-foreground truncate">
              {currentFile.artist}
            </p>
          </div>
          <ChevronUp size={16} className="text-muted-foreground/50 group-hover:text-foreground transition-colors" />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => previousTrack(files)} className="hidden sm:inline-flex">
            <SkipBack size={20} />
          </Button>
          <Button
            size="icon"
            onClick={togglePlayback}
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
          >
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => nextTrack(files)}>
            <SkipForward size={20} />
          </Button>
        </div>

        <div className="flex items-center gap-4 text-muted-foreground">
          <Button variant="ghost" size="icon" className="hidden md:inline-flex">
            <Volume2 size={20} />
          </Button>
          <Button variant="ghost" size="icon" className="hidden md:inline-flex">
            <ListMusic size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
};
