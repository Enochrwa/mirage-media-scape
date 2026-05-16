import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { X, Play } from 'lucide-react';
import { MiniPlayer } from './player/MiniPlayer';
import { FullNowPlaying } from './player/FullNowPlaying';
import VideoPlayer from './VideoPlayer';

const PlayerWrapper = () => {
  const { currentFile, isPlayerFullscreen, currentTime, playbackEngine: pe } = usePlayerStore();
  const [showResume, setShowResume] = useState(false);
  const [hasCheckedResume, setHasCheckedResume] = useState(false);

  useEffect(() => {
    // If we have a currentFile but it's not playing and we just restored it
    if (currentFile && !hasCheckedResume) {
      const { isPlaying } = usePlayerStore.getState();
      if (!isPlaying && currentTime > 5) {
        setShowResume(true);
      }
      setHasCheckedResume(true);
    }
  }, [currentFile, hasCheckedResume, currentTime]);

  if (!currentFile) {
    return null;
  }

  if (currentFile.type === 'video') {
    return <VideoPlayer />;
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = Math.floor(s % 60);
    return `${m}:${rs < 10 ? '0' : ''}${rs}`;
  };

  return (
    <>
      {showResume && (
        <div className="fixed bottom-24 left-4 right-4 z-[60] md:left-auto md:right-4 md:w-80">
          <Card className="flex items-center gap-4 border-primary/20 bg-background/95 p-4 shadow-2xl backdrop-blur">
            <img
              src={currentFile.cover || '/placeholder.svg'}
              className="h-12 w-12 rounded object-cover"
            />
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-xs font-bold">Resume playback?</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {currentFile.title} at {formatTime(currentTime)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setShowResume(false)}
              >
                <X size={14} />
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1 px-3 text-xs"
                onClick={() => {
                  pe.play();
                  setShowResume(false);
                }}
              >
                <Play size={12} fill="currentColor" /> Resume
              </Button>
            </div>
          </Card>
        </div>
      )}
      <MiniPlayer />
      {isPlayerFullscreen && <FullNowPlaying />}
    </>
  );
};

export default PlayerWrapper;
