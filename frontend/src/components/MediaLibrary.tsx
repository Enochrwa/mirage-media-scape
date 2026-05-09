import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLibraryStore } from '@/store/useLibraryStore'; import { MediaFile, MediaType } from '@/types/media';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import LibraryGrid from './LibraryGrid';

interface MediaLibraryProps {
  className?: string;
  mediaType?: MediaType;
}

const MediaLibrary: React.FC<MediaLibraryProps> = ({ className, mediaType: initialMediaType }) => {
  const { files } = useLibraryStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [mediaType, setMediaType] = useState<MediaType | 'all'>(initialMediaType || 'all');
  const location = useLocation();

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
  
  const filteredFiles = safeFiles.filter(file => {
    const matchesSearch = file.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (file.artist && file.artist.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (file.album && file.album.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = mediaType === 'all' || file.type === mediaType;
    
    return matchesSearch && matchesType;
  });
  
  const audioFiles = safeFiles.filter(file => file.type === 'audio');
  const videoFiles = safeFiles.filter(file => file.type === 'video');
  
  const renderMediaGrid = (filesToRender: MediaFile[]) => (
    filesToRender.length > 0 ? (
      <LibraryGrid files={filesToRender} />
    ) : (
      <p className="text-center text-muted-foreground py-10">
        {searchTerm ? 'No matching files found.' : 'No media files found.'}
      </p>
    )
  );
  
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Your Library</h1>
        <div className="w-full sm:w-auto">
          <Input
            placeholder="Search by title, artist or album..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-72 bg-secondary"
          />
        </div>
      </div>
      
      {initialMediaType ? (
        <div className="mt-6">
          {renderMediaGrid(filteredFiles)}
        </div>
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
            {renderMediaGrid(filteredFiles.filter(f => f.type === 'audio'))}
          </TabsContent>

          <TabsContent value="video" className="mt-6">
            {renderMediaGrid(filteredFiles.filter(f => f.type === 'video'))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default MediaLibrary;