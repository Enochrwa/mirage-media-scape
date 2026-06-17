import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { X, Play } from 'lucide-react';
import { MiniPlayer } from './player/MiniPlayer';
import { FullNowPlaying } from './player/FullNowPlaying';
import VideoPlayer from './VideoPlayer';

const PlayerWrapper = () => {
  const {
    currentFile,
    isPlayerFullscreen,
    currentTime,
    playbackEngine: pe,
    closePlayer,
  } = usePlayerStore();
  const [showResume, setShowResume] = useState(false);
  const [hasCheckedResume, setHasCheckedResume] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  useEffect(() => {
    if (currentFile && !hasCheckedResume) {
      const { isPlaying } = usePlayerStore.getState();
      if (!isPlaying && currentTime > 5) {
        setShowResume(true);
        setHasCheckedResume(true);
      } else if (isPlaying) {
        setHasCheckedResume(true);
      }
    }
  }, [currentFile, hasCheckedResume, currentTime]);

  // When a video file is selected, automatically show the video modal
  useEffect(() => {
    if (currentFile?.type === 'video') {
      setShowVideoModal(true);
    } else {
      setShowVideoModal(false);
    }
  }, [currentFile?.id, currentFile?.type]);

  if (!currentFile) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = Math.floor(s % 60);
    return `${m}:${rs < 10 ? '0' : ''}${rs}`;
  };

  const handleCloseVideo = () => {
    setShowVideoModal(false);
    closePlayer();
  };

  return (
    <>
      {/* Resume toast */}
      {showResume && currentFile.type !== 'video' && (
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

      {/* Video fullscreen modal */}
      {currentFile.type === 'video' && showVideoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
          <VideoPlayer onClose={handleCloseVideo} />
        </div>
      )}

      {/* Audio mini player (always rendered when audio is active) */}
      {currentFile.type === 'audio' && <MiniPlayer />}

      {/* Full audio player overlay */}
      {currentFile.type === 'audio' && isPlayerFullscreen && <FullNowPlaying />}
    </>
  );
};

export default PlayerWrapper;
