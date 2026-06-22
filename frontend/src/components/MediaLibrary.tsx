import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLibraryStore } from '@/store/useLibraryStore';
import { MediaFile, MediaType } from '@/types/media';
import { API_BASE, cn } from '@/lib/utils';
import { useHost } from '@/platform';
import { MobileMediaService } from '@/services/mobileMedia/MobileMediaService';
import { FolderSearch, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import LibraryGrid from './LibraryGrid';
import LibraryOnboarding from './LibraryOnboarding';
import EmptyLibraryState from './EmptyLibraryState';

interface MediaLibraryProps {
  className?: string;
  mediaType?: MediaType;
}

const MediaLibrary: React.FC<MediaLibraryProps> = ({ className, mediaType: initialMediaType }) => {
  const {
    files,
    fetchInstantTracks,
    fetchTracks,
    fetchSmartPlaylists,
    scanProgress,
    needsPermission,
  } = useLibraryStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>(() => {
    const saved = localStorage.getItem('ZOVYRA_sort_songs');
    return saved ? JSON.parse(saved) : { field: 'title', direction: 'asc' };
  });
  const [mediaType, setMediaType] = useState<MediaType | 'all'>(initialMediaType || 'all');
  const [bootChecked, setBootChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();
  const host = useHost();

  useEffect(() => {
    if (host !== 'web') {
      // Desktop and mobile handle their own library loading in useLibraryStore.init()
      // No onboarding needed
      setBootChecked(true);
      return;
    }

    // Web-only: check if onboarding is needed
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/scanner/bootstrap`);
        if (!res.ok) return;
        const data = (await res.json()) as { folderCount: number; onboardingComplete: boolean };
        if (cancelled) return;
        if (data.folderCount === 0 && !data.onboardingComplete && safeFiles.length === 0) {
          setShowOnboarding(true);
        }
      } catch {
        /* offline or server down — skip onboarding gate */
      } finally {
        if (!cancelled) setBootChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // safeFiles.length intentionally omitted: bootstrap check is a one-time mount
    // gate; we don't want it to re-run every time the library loads more tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  useEffect(() => {
    localStorage.setItem('ZOVYRA_sort_songs', JSON.stringify(sortConfig));
  }, [sortConfig]);

  useEffect(() => {
    if (initialMediaType) {
      setMediaType(initialMediaType);
    } else {
      const hash = location.hash;
      if (hash === '#videos') {
        setMediaType('video');
      } else if (hash === '#music') {
        setMediaType('audio');
      } else {
        setMediaType('all');
      }
    }
  }, [location, initialMediaType]);

  // Ensure files is an array before filtering
  const safeFiles = Array.isArray(files) ? files : [];

  // Use initialMediaType if provided, otherwise use mediaType state
  const effectiveMediaType = initialMediaType || mediaType;

  const filteredFiles = safeFiles
    .filter((file) => {
      const matchesSearch =
        file.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (file.artist && file.artist.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (file.album && file.album.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = effectiveMediaType === 'all' || file.type === effectiveMediaType;

      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const field = sortConfig.field as keyof MediaFile;
      const aVal = String(a[field] || '').toLowerCase();
      const bVal = String(b[field] || '').toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const audioFiles = safeFiles.filter((file) => file.type === 'audio');
  const videoFiles = safeFiles.filter((file) => file.type === 'video');

  const renderMediaGrid = (filesToRender: MediaFile[]) => {
    if (filesToRender.length > 0) {
      return <LibraryGrid files={filesToRender} />;
    }

    if (searchTerm) {
      return (
        <p className="py-10 text-center text-muted-foreground">
          No matching files found for "{searchTerm}".
        </p>
      );
    }

    if (safeFiles.length === 0) {
      return <EmptyLibraryState onAddFolder={() => setShowOnboarding(true)} />;
    }

    return (
      <p className="py-10 text-center text-muted-foreground">
        No media files found in this category.
      </p>
    );
  };

  if (!bootChecked) {
    return (
      <div className={cn('space-y-6', className)}>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Mobile permission denied
  if (host === 'mobile' && needsPermission) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="rounded-full bg-amber-500/10 p-6">
          <Music className="h-16 w-16 text-amber-500" />
        </div>
        <div>
          <h3 className="text-2xl font-bold">Media Access Needed</h3>
          <p className="mt-2 max-w-sm text-muted-foreground">
            Zovyra needs permission to access your music and videos. Please allow access in your
            device settings.
          </p>
        </div>
        <Button
          onClick={() =>
            MobileMediaService.requestPermissions().then(() => window.location.reload())
          }
        >
          Grant Permission
        </Button>
      </div>
    );
  }

  // Desktop/mobile: scanning in progress
  if (host !== 'web' && files.length === 0 && scanProgress) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <div className="relative">
          <div className="h-20 w-20 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500" />
          <Music className="absolute inset-0 m-auto h-8 w-8 text-purple-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold">
            {host === 'mobile' ? 'Reading your media library...' : 'Finding your media...'}
          </h3>
          {scanProgress.total > 0 && (
            <p className="mt-1 text-muted-foreground">
              {scanProgress.scanned} of {scanProgress.total} files
            </p>
          )}
        </div>
      </div>
    );
  }

  // Desktop: scan done but nothing found
  if (host === 'desktop' && files.length === 0 && !scanProgress) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <FolderSearch className="h-20 w-20 text-muted-foreground/20" />
        <h3 className="text-xl font-bold">No media found</h3>
        <p className="max-w-sm text-muted-foreground">
          We scanned your Music and Videos folders but found nothing. Make sure your files are in
          ~/Music or ~/Videos.
        </p>
        <Button
          variant="outline"
          onClick={() => fetch(`${API_BASE}/api/scanner/auto-scan-defaults`, { method: 'POST' })}
        >
          Scan Again
        </Button>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <LibraryOnboarding
        onComplete={() => {
          setShowOnboarding(false);
          void fetchInstantTracks();
          void fetchTracks();
          void fetchSmartPlaylists();
        }}
      />
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-xl font-bold tracking-tight sm:text-3xl">Your Library</h1>
        <div className="w-full sm:w-auto">
          <Input
            placeholder="Search by title, artist or album..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-secondary sm:w-72"
          />
        </div>
      </div>

      {scanProgress && (
        <div className="flex items-center gap-3 rounded-lg border border-purple-500/20 bg-purple-500/10 p-3 text-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <span>
            Scanning library... {scanProgress.percentage}% ({scanProgress.scanned} /{' '}
            {scanProgress.total} files)
          </span>
        </div>
      )}

      {initialMediaType ? (
        <div className="mt-6">{renderMediaGrid(filteredFiles)}</div>
      ) : (
        <Tabs
          value={mediaType}
          className="w-full"
          onValueChange={(value) => setMediaType(value as MediaType | 'all')}
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all" className="flex-1 sm:flex-none">
              <span className="sm:hidden">All ({safeFiles.length})</span>
              <span className="hidden sm:inline">All Media ({safeFiles.length})</span>
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex-1 sm:flex-none">
              <span className="sm:hidden">Music ({audioFiles.length})</span>
              <span className="hidden sm:inline">Music ({audioFiles.length})</span>
            </TabsTrigger>
            <TabsTrigger value="video" className="flex-1 sm:flex-none">
              <span className="sm:hidden">Videos ({videoFiles.length})</span>
              <span className="hidden sm:inline">Videos ({videoFiles.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {renderMediaGrid(filteredFiles)}
          </TabsContent>

          <TabsContent value="audio" className="mt-6">
            {renderMediaGrid(filteredFiles.filter((f) => f.type === 'audio'))}
          </TabsContent>

          <TabsContent value="video" className="mt-6">
            {renderMediaGrid(filteredFiles.filter((f) => f.type === 'video'))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default MediaLibrary;
