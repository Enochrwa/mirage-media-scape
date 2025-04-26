
import React from 'react';
import Sidebar, { SidebarView } from '@/components/Sidebar';
import AudioPlayer from '@/components/AudioPlayer';
import VideoPlayer from '@/components/VideoPlayer';
import { useMedia } from '@/contexts/MediaContext';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  className?: string;
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ className, children }) => {
  const { currentFile, isPlaying, showPlayer } = useMedia();
  
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className={cn("mx-auto max-w-7xl", className)}>
            {children}
          </div>
        </div>
        
        {showPlayer && currentFile && (
          <div className="p-4 border-t border-border">
            {currentFile.type === 'audio' ? (
              <div className="max-w-3xl mx-auto">
                <AudioPlayer />
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                <VideoPlayer />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default MainLayout;
