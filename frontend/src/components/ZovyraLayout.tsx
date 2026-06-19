import { Sidebar } from '@/components/layout/Sidebar';
import { PlaybackController } from '@/components/player/PlaybackController';
import { MoodSlider } from '@/components/discovery/MoodSlider';
import { MobilePlayer } from '@/components/player/MobilePlayer';
import { useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';

// ✅ ZovyraLayout no longer renders VideoPlayer directly.
// VideoPlayer is managed exclusively by PlayerWrapper (inside MainLayout),
// which correctly gates it behind a user-initiated open + file-id tracking.
// Having two VideoPlayer instances caused both simultaneous playback and
// the "video keeps appearing on other routes" bug.

interface ZovyraLayoutProps {
  children: React.ReactNode;
}

export function ZovyraLayout({ children }: ZovyraLayoutProps) {
  const [showMobilePlayer, setShowMobilePlayer] = useState(false);
  const { currentFile } = usePlayerStore();

  const isVideo = currentFile?.type === 'video';

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

      {/* Persistent Player Bar — audio only */}
      {!isVideo && <PlaybackController />}

      {/* Mobile player tap target */}
      {!isVideo && (
        <div
          className="fixed bottom-20 right-4 z-30 md:hidden"
          onClick={() => setShowMobilePlayer(true)}
        />
      )}

      {/* Fullscreen Mobile Player Overlay */}
      {showMobilePlayer && (
        <div className="md:hidden">
          <MobilePlayer onClose={() => setShowMobilePlayer(false)} />
        </div>
      )}
    </div>
  );
}
