import { Sidebar } from "@/components/layout/Sidebar";
import { PlaybackController } from "@/components/player/PlaybackController";
import { MoodSlider } from "@/components/discovery/MoodSlider";
import { MobilePlayer } from "@/components/player/MobilePlayer";
import { useState } from "react";

interface SonicLayoutProps {
  children: React.ReactNode;
}

export function SonicLayout({ children }: SonicLayoutProps) {
  const [showMobilePlayer, setShowMobilePlayer] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden font-sans">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        <main className="flex-1 flex flex-col relative overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>

          {/* Floating Mood Engine for Desktop */}
          <div className="absolute top-8 right-8 w-80 z-20 hidden xl:block">
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
