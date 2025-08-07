import React from 'react';
import { useMedia } from '@/contexts/MediaContext';
import AudioPlayer from './AudioPlayer';
import VideoPlayer from './VideoPlayer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PlayerModal = () => {
  const { currentFile, closePlayer } = useMedia();

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
      <DialogContent className="max-w-4xl h-auto">
        <DialogHeader>
          <DialogTitle>{currentFile.title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {currentFile.type === 'audio' && <AudioPlayer file={currentFile} />}
          {currentFile.type === 'video' && <VideoPlayer file={currentFile} />}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerModal;
