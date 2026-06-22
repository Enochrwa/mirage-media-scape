import React from 'react';
import MainLayout from '@/components/MainLayout';
import MediaLibrary from '@/components/MediaLibrary';
import MobileTopBar from '@/components/MobileTopBar';

const Videos = () => {
  return (
    <MainLayout>
      <MobileTopBar title="Videos" />
      <MediaLibrary mediaType="video" />
    </MainLayout>
  );
};

export default Videos;
