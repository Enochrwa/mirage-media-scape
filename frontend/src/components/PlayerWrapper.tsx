import React from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import AudioPlayer from './AudioPlayer';
import VideoPlayer from './VideoPlayer';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const PlayerWrapper = () => {
  const { currentFile, closePlayer } = usePlayerStore();

  if (!currentFile) {
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closePlayer();
    }
  };

  return (
    <Dialog open={!!currentFile} onOpenChange={handleOpenChange}>
      <DialogContent className="h-full max-h-none w-full max-w-none border-0 bg-transparent p-0">
        {currentFile.type === 'audio' && <AudioPlayer file={currentFile} />}
        {currentFile.type === 'video' && <VideoPlayer file={currentFile} />}
      </DialogContent>
    </Dialog>
  );
};

export default PlayerWrapper;
