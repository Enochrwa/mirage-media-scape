import React from 'react';
import MainLayout from '@/components/MainLayout';
import MediaLibrary from '@/components/MediaLibrary';

const Music = () => {
  return (
    <MainLayout>
      <MediaLibrary mediaType="audio" />
    </MainLayout>
  );
};

export default Music;
