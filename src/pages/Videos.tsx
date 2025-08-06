import React from 'react';
import MainLayout from '@/components/MainLayout';
import MediaLibrary from '@/components/MediaLibrary';

const Videos = () => {
  return (
    <MainLayout>
      <MediaLibrary mediaType="video" />
    </MainLayout>
  );
};

export default Videos;
