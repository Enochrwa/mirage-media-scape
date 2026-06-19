import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    setPlayerFullscreen,
    currentTime,
    playbackEngine: pe,
    closePlayer,
    pausePlayback,
  } = usePlayerStore();
  const [showResume, setShowResume] = useState(false);
  const [hasCheckedResume, setHasCheckedResume] = useState(false);

  // video modal only opens for NEW video files — not on every re-render / navigation
  const [showVideoModal, setShowVideoModal] = useState(false);
  const prevFileId = useRef<string | null>(null);

  useEffect(() => {
    if (!currentFile) {
      setShowVideoModal(false);
      prevFileId.current = null;
      return;
    }
    if (currentFile.type === 'video' && currentFile.id !== prevFileId.current) {
      setShowVideoModal(true);
      prevFileId.current = currentFile.id;
    }
    if (currentFile.type !== 'video') {
      setShowVideoModal(false);
    }
  }, [currentFile?.id, currentFile?.type, currentFile]);

  // Resume toast — only fires once per session
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

  const handleCloseVideo = useCallback(() => {
    pausePlayback();
    setShowVideoModal(false);
    prevFileId.current = null;
    closePlayer();
  }, [pausePlayback, closePlayer]);

  // Close FullNowPlaying when navigating by ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPlayerFullscreen) {
        setPlayerFullscreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlayerFullscreen, setPlayerFullscreen]);

  if (!currentFile) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = Math.floor(s % 60);
    return `${m}:${rs < 10 ? '0' : ''}${rs}`;
  };

  return (
    <>
      {/* Resume toast — audio only, dismisses automatically */}
      {showResume && currentFile.type !== 'video' && (
        <div className="fixed bottom-24 left-4 right-4 z-[60] md:left-auto md:right-4 md:w-80 animate-in slide-in-from-bottom-4">
          <Card className="flex items-center gap-4 border-primary/20 bg-background/95 p-4 shadow-2xl backdrop-blur">
            <img
              src={currentFile.cover || '/placeholder.svg'}
              className="h-12 w-12 rounded object-cover"
              alt=""
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

      {/* Video fullscreen modal — only when explicitly opened for a NEW video */}
      {currentFile.type === 'video' && showVideoModal && (
        <div className="fixed inset-0 z-[200] bg-black">
          <VideoPlayer onClose={handleCloseVideo} />
        </div>
      )}

      {/* Audio mini player — always visible when audio loaded, does NOT block navigation */}
      {currentFile.type === 'audio' && <MiniPlayer />}

      {/*
        Full audio player overlay.
        CRITICAL FIX: render as a portal-like overlay that has a backdrop click
        so users can dismiss it if it ever gets stuck. Also ensure ESC closes it.
      */}
      {currentFile.type === 'audio' && isPlayerFullscreen && (
        <>
          {/* Invisible click-outside zone to close (only at very edge) */}
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => setPlayerFullscreen(false)}
          />
          <FullNowPlaying />
        </>
      )}
    </>
  );
};

export default PlayerWrapper;
