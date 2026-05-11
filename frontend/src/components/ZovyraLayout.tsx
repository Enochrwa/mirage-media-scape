import { Sidebar } from '@/components/layout/Sidebar';
import { PlaybackController } from '@/components/player/PlaybackController';
import { MoodSlider } from '@/components/discovery/MoodSlider';
import { MobilePlayer } from '@/components/player/MobilePlayer';
import { useState } from 'react';

interface ZovyraLayoutProps {
  children: React.ReactNode;
}

export function ZovyraLayout({ children }: ZovyraLayoutProps) {
  const [showMobilePlayer, setShowMobilePlayer] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black font-sans text-white">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        <main className="relative flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">{children}</div>

          {/* Floating Mood Engine for Desktop */}
          <div className="absolute right-8 top-8 z-20 hidden w-80 xl:block">
            <MoodSlider />
          </div>
        </main>
      </div>

      {/* Persistent Player Bar */}
      <div className="block" onClick={() => setShowMobilePlayer(true)}>
        <PlaybackController />
      </div>

      {/* Fullscreen Mobile Player Overlay */}
      {showMobilePlayer && (
        <div className="md:hidden">
          <MobilePlayer onClose={() => setShowMobilePlayer(false)} />
        </div>
      )}
    </div>
  );
}
