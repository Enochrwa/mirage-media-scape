import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useMedia, MediaFile, MediaType } from '@/contexts/MediaContext';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Music, Film, Play, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface MediaItemProps {
  file: MediaFile;
}

const MediaItem: React.FC<MediaItemProps> = ({ file }) => {
  const { playFile, playlists, addToPlaylist } = useMedia();
  
  return (
    <Card className="group overflow-hidden bg-card hover:bg-card/80 transition-colors">
      <div className="relative aspect-square overflow-hidden">
        <img 
          src={file.cover || '/placeholder.svg'} 
          alt={file.title} 
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button 
            size="icon"
            className="rounded-full bg-primary hover:bg-primary/90 w-12 h-12"
            onClick={() => playFile(file)}
          >
            <Play className="h-5 w-5 ml-0.5" />
          </Button>
        </div>
        {file.type === 'video' && (
          <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
            <Film className="h-4 w-4 text-white" />
          </div>
        )}
        {file.type === 'audio' && (
          <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
            <Music className="h-4 w-4 text-white" />
          </div>
        )}
      </div>
      <div className="p-3 flex items-center justify-between">
        <div className="flex-1 min-w-0 mr-2">
          <p className="font-medium truncate">{file.title}</p>
          <p className="text-sm text-muted-foreground truncate">{file.artist || 'Unknown Artist'}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => playFile(file)}>
              Play
            </DropdownMenuItem>
            <DropdownMenuItem>
              Add to Queue
            </DropdownMenuItem>
            {playlists && playlists.length > 0 && (
              <>
                <DropdownMenuItem disabled className="font-medium">
                  Add to Playlist:
                </DropdownMenuItem>
                {playlists.map(playlist => (
                  <DropdownMenuItem 
                    key={playlist.id} 
                    className="pl-6"
                    onClick={() => addToPlaylist(playlist.id, file.id)}
                  >
                    {playlist.name}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
};

interface MediaLibraryProps {
  className?: string;
  mediaType?: MediaType;
}

const MediaLibrary: React.FC<MediaLibraryProps> = ({ className, mediaType: initialMediaType }) => {
  const { files } = useMedia();
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filesToRender.map(file => (
          <MediaItem key={file.id} file={file} />
        ))}
      </div>
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