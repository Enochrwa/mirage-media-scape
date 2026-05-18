import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense, useState } from 'react';
import { useLibraryStore } from '@/store/useLibraryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useAuthStore } from '@/store/useAuthStore';
import { WifiOff, Loader2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useCapability } from './platform';
import { useMediaSession } from './hooks/useMediaSession';

const queryClient = new QueryClient();

const Home = lazy(() => import('./pages/Home'));
const Library = lazy(() => import('./pages/Library'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const RemotePage = lazy(() => import('./pages/RemotePage'));
const DuplicateManagerPage = lazy(() => import('./pages/DuplicateManagerPage'));
const RadioPage = lazy(() => import('./pages/RadioPage'));
const PodcastsPage = lazy(() => import('./pages/PodcastsPage'));
const Music = lazy(() => import('./pages/Music'));
const Videos = lazy(() => import('./pages/Videos'));
const Upload = lazy(() => import('./pages/Upload'));
const Playlists = lazy(() => import('./pages/Playlists'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Settings = lazy(() => import('./pages/Settings'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Discover = lazy(() => import('./pages/Discover'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const ArtistProfile = lazy(() => import('./pages/ArtistProfile').then(m => ({ default: m.ArtistProfile })));
const ZovyraLayout = lazy(() => import('./components/ZovyraLayout').then(m => ({ default: m.ZovyraLayout })));
const AlbumView = lazy(() => import('./pages/AlbumView').then(m => ({ default: m.AlbumView })));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));

const PageSkeleton = () => (
  <div className="flex h-full w-full items-center justify-center bg-background">
    <div className="h-32 w-32 animate-pulse bg-secondary rounded-lg flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
    </div>
  </div>
);

const App = () => {
  useMediaSession();
  const initLibrary = useLibraryStore((state) => state.init);
  const initAuth = useAuthStore((state) => state.init);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const canSyncInBackground = useCapability('canSyncInBackground');

  useEffect(() => {
    initAuth();
    initLibrary();
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (canSyncInBackground && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [initLibrary, canSyncInBackground]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcuts
      const player = usePlayerStore.getState();

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
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
            <div className="fixed left-0 right-0 top-0 z-[100] bg-amber-600 py-1 text-center text-xs font-bold text-white animate-in slide-in-from-top">
              <div className="flex items-center justify-center gap-2">
                <WifiOff size={14} /> You're offline — local library available
              </div>
            </div>
          )}
          <Toaster />
          <Sonner />
          <ErrorBoundary>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Suspense fallback={<PageSkeleton />}>
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
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/discover" element={<Discover />} />
                  <Route path="/profile/:userId" element={<UserProfile />} />
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
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
