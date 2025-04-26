
import React from 'react';
import { MediaProvider } from '@/contexts/MediaContext';
import Home from '@/pages/Home';

const Index = () => {
  return (
    <MediaProvider>
      <Home />
    </MediaProvider>
  );
};

export default Index;
