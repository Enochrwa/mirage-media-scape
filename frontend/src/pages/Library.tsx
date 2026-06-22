import React from 'react';
import MainLayout from '@/components/MainLayout';
import MediaLibrary from '@/components/MediaLibrary';
import MobileTopBar from '@/components/MobileTopBar';

const Library = () => {
  return (
    <MainLayout>
      <MobileTopBar title="Library" />
      <MediaLibrary />
    </MainLayout>
  );
};

export default Library;
