import React from 'react';
import MainLayout from '@/components/MainLayout';
import MobileTopBar from '@/components/MobileTopBar';
import UploadMedia from '@/components/UploadMedia';

const Upload = () => {
  return (
    <MainLayout>
      <MobileTopBar title="Upload" />
      <UploadMedia />
    </MainLayout>
  );
};

export default Upload;
