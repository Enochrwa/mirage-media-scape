import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useLibraryStore } from '@/store/useLibraryStore';
import Index from './pages/Index';
import Home from './pages/Home';
import Library from './pages/Library';
import StatsPage from './pages/StatsPage';
import RemotePage from './pages/RemotePage';
import DuplicateManagerPage from './pages/DuplicateManagerPage';
import RadioPage from './pages/RadioPage';
import Music from './pages/Music';
import Videos from './pages/Videos';
import Upload from './pages/Upload';
import Playlists from './pages/Playlists';
import Favorites from './pages/Favorites';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import { ArtistProfile } from './pages/ArtistProfile';
import { SonicLayout } from './components/SonicLayout';

const queryClient = new QueryClient();

const App = () => {
  const initLibrary = useLibraryStore((state) => state.init);

  useEffect(() => {
    initLibrary();
  }, [initLibrary]);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={
                  <SonicLayout>
                    <ArtistProfile />
                  </SonicLayout>
                }
              />
              <Route
                path="/artist"
                element={
                  <SonicLayout>
                    <ArtistProfile />
                  </SonicLayout>
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
              <Route path="/remote" element={<RemotePage />} />
              <Route path="/duplicates" element={<DuplicateManagerPage />} />
              <Route path="/radio" element={<RadioPage />} />
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
