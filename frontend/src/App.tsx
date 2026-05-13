import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useLibraryStore } from '@/store/useLibraryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import Index from './pages/Index';
import Home from './pages/Home';
import Library from './pages/Library';
import StatsPage from './pages/StatsPage';
import RemotePage from './pages/RemotePage';
import DuplicateManagerPage from './pages/DuplicateManagerPage';
import RadioPage from './pages/RadioPage';
import PodcastsPage from './pages/PodcastsPage';
import Music from './pages/Music';
import Videos from './pages/Videos';
import Upload from './pages/Upload';
import Playlists from './pages/Playlists';
import Favorites from './pages/Favorites';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import { ArtistProfile } from './pages/ArtistProfile';
import { ZovyraLayout } from './components/ZovyraLayout';
import { AlbumView } from './pages/AlbumView';
import { WifiOff } from 'lucide-react';
import { useState } from 'react';

const queryClient = new QueryClient();

const App = () => {
  const initLibrary = useLibraryStore((state) => state.init);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    initLibrary();
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if ('serviceWorker' in navigator) {
       navigator.serviceWorker.register('/sw.js');
    }

    return () => {
       window.removeEventListener('online', onOnline);
       window.removeEventListener('offline', onOffline);
    };
  }, [initLibrary]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcuts
      const player = usePlayerStore.getState();
      const library = useLibraryStore.getState();

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch(e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          player.togglePlayback();
          break;
        case 'n':
          player.nextTrack();
          break;
        case 'p':
          player.previousTrack();
          break;
        case 'f':
          if (player.currentFile?.type === 'video') {
             // Handle fullscreen
          }
          break;
        case 'm':
          // Toggle mute
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {isOffline && (
             <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-600 text-white text-center py-1 text-xs font-bold animate-in slide-in-from-top">
                <div className="flex items-center justify-center gap-2">
                   <WifiOff size={14} /> You're offline — local library available
                </div>
             </div>
          )}
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={
                  <ZovyraLayout>
                    <ArtistProfile />
                  </ZovyraLayout>
                }
              />
              <Route
                path="/artist"
                element={
                  <ZovyraLayout>
                    <ArtistProfile />
                  </ZovyraLayout>
                }
              />
              <Route path="/home" element={<Home />} />
              <Route path="/library" element={<Library />} />
              <Route path="/music" element={<Music />} />
              <Route path="/videos" element={<Videos />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/album/:id" element={<AlbumView />} />
              <Route path="/artist/:name" element={<ArtistProfile />} />
              <Route path="/remote" element={<RemotePage />} />
              <Route path="/duplicates" element={<DuplicateManagerPage />} />
              <Route path="/radio" element={<RadioPage />} />
              <Route path="/podcasts" element={<PodcastsPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
