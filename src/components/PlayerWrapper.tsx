import React from 'react';
import { useMedia } from '@/contexts/MediaContext';
import AudioPlayer from './AudioPlayer';
import VideoPlayer from './VideoPlayer';

const PlayerWrapper = () => {
  const { currentFile } = useMedia();

  if (!currentFile) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {currentFile.type === 'audio' && <AudioPlayer file={currentFile} />}
      {currentFile.type === 'video' && <VideoPlayer file={currentFile} />}
    </div>
  );
};

export default PlayerWrapper;
