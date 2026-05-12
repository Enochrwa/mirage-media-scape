import React from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { MiniPlayer } from './player/MiniPlayer';
import { FullNowPlaying } from './player/FullNowPlaying';
import VideoPlayer from './VideoPlayer';

const PlayerWrapper = () => {
  const { currentFile, isPlayerFullscreen } = usePlayerStore();

  if (!currentFile) {
    return null;
  }

  if (currentFile.type === 'video') {
    return <VideoPlayer />;
  }

  return (
    <>
      <MiniPlayer />
      {isPlayerFullscreen && <FullNowPlaying />}
    </>
  );
};

export default PlayerWrapper;
