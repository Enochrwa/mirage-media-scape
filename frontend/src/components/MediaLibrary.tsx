import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLibraryStore } from '@/store/useLibraryStore';
import { MediaFile, MediaType } from '@/types/media';
import { API_BASE, cn } from '@/lib/utils';
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
  const { files, fetchInstantTracks, fetchTracks, fetchSmartPlaylists } = useLibraryStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>(() => {
    const saved = localStorage.getItem('ZOVYRA_sort_songs');
    return saved ? JSON.parse(saved) : { field: 'title', direction: 'asc' };
  });
  const [mediaType, setMediaType] = useState<MediaType | 'all'>(initialMediaType || 'all');
  const [bootChecked, setBootChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/scanner/bootstrap`);
        if (!res.ok) return;
        const data = (await res.json()) as { folderCount: number; onboardingComplete: boolean };
        if (cancelled) return;
        if (data.folderCount === 0 && !data.onboardingComplete) {
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
  }, []);

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

  const filteredFiles = safeFiles
    .filter((file) => {
      const matchesSearch =
        file.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (file.artist && file.artist.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (file.album && file.album.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = mediaType === 'all' || file.type === mediaType;

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
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-bold tracking-tight">Your Library</h1>
        <div className="w-full sm:w-auto">
          <Input
            placeholder="Search by title, artist or album..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-secondary sm:w-72"
          />
        </div>
      </div>

      {initialMediaType ? (
        <div className="mt-6">{renderMediaGrid(filteredFiles)}</div>
      ) : (
        <Tabs
          value={mediaType}
          className="w-full"
          onValueChange={(value) => setMediaType(value as MediaType | 'all')}
        >
          <TabsList>
            <TabsTrigger value="all">All Media ({safeFiles.length})</TabsTrigger>
            <TabsTrigger value="audio">Music ({audioFiles.length})</TabsTrigger>
            <TabsTrigger value="video">Videos ({videoFiles.length})</TabsTrigger>
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
