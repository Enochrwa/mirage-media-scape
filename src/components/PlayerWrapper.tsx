import React from 'react';
import { useMedia } from '@/contexts/MediaContext';
import AudioPlayer from './AudioPlayer';
import VideoPlayer from './VideoPlayer';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"

const PlayerWrapper = () => {
  const { currentFile, closePlayer } = useMedia();

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
      <DialogContent className="p-0 border-0 bg-transparent w-full max-w-none h-full max-h-none">
        {currentFile.type === 'audio' && <AudioPlayer file={currentFile} />}
        {currentFile.type === 'video' && <VideoPlayer file={currentFile} />}
      </DialogContent>
    </Dialog>
  );
};

export default PlayerWrapper;
