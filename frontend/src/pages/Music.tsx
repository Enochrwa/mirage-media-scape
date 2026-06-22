import React from 'react';
import MainLayout from '@/components/MainLayout';
import MediaLibrary from '@/components/MediaLibrary';
import MobileTopBar from '@/components/MobileTopBar';

const Music = () => {
  return (
    <MainLayout>
      <MobileTopBar title="Music" />
      <MediaLibrary mediaType="audio" />
    </MainLayout>
  );
};

export default Music;
