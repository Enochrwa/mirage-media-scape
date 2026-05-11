import React from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import AudioPlayer from './AudioPlayer';
import VideoPlayer from './VideoPlayer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PlayerModal = () => {
  const { currentFile, closePlayer } = usePlayerStore();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closePlayer();
    }
  };

  if (!currentFile) {
    return null;
  }

  return (
    <Dialog open={!!currentFile} onOpenChange={handleOpenChange}>
      <DialogContent className="h-auto max-w-4xl">
        <DialogHeader>
          <DialogTitle>{currentFile.title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {currentFile.type === 'audio' && <AudioPlayer />}
          {currentFile.type === 'video' && <VideoPlayer />}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerModal;
