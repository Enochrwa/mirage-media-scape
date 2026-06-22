import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import MobileTopBar from '@/components/MobileTopBar';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { MediaFile } from '@/types/media';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, Play, Music, Film, ListMusic, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

interface MediaCardProps {
  file: MediaFile;
  onRemoveFavorite: (id: string) => void;
}

const MediaCard: React.FC<MediaCardProps> = ({ file, onRemoveFavorite }) => {
  const { playFile } = usePlayerStore();

  return (
    <Card className="group relative overflow-hidden">
      <div className="aspect-square">
        <img
          src={file.cover || '/placeholder.svg'}
          alt={file.title}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />

        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
            onClick={() => playFile(file)}
          >
            <Play className="ml-0.5 h-5 w-5" />
          </Button>
          <Button
            className="h-10 w-10 rounded-full bg-red-500/80 hover:bg-red-500"
            onClick={() => onRemoveFavorite(file.id)}
          >
            <Heart className="h-4 w-4 fill-current" />
          </Button>
        </div>
      </div>
      <div className="p-3">
        <p className="truncate font-medium">{file.title}</p>
        <p className="truncate text-sm text-muted-foreground">{file.artist || 'Unknown Artist'}</p>
      </div>
    </Card>
  );
};

const Favorites = () => {
  // In a real app, favorites would be stored in the state or database
  // For this demo, we're using the existing files as "favorites"
  const { files } = useLibraryStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<MediaFile[]>(files.slice(0, 5));

  const audioFavorites = favorites.filter((file) => file.type === 'audio');
  const videoFavorites = favorites.filter((file) => file.type === 'video');

  const removeFavorite = (id: string) => {
    setFavorites((prev) => prev.filter((file) => file.id !== id));
  };

  const filteredFavorites = favorites.filter(
    (file) =>
      file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (file.artist && file.artist.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <MainLayout>
      <MobileTopBar title="Favorites" />
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="mb-1 flex items-center gap-2 text-4xl font-bold tracking-tight">
              <Heart className="h-8 w-8 text-red-500" /> Favorites
            </h1>
            <p className="text-muted-foreground">Your most loved tracks and videos</p>
          </div>

          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search favorites..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6 grid w-[300px] grid-cols-3">
            <TabsTrigger value="all">All ({favorites.length})</TabsTrigger>
            <TabsTrigger value="music">Music ({audioFavorites.length})</TabsTrigger>
            <TabsTrigger value="videos">Videos ({videoFavorites.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            {filteredFavorites.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {filteredFavorites.map((file) => (
                  <MediaCard key={file.id} file={file} onRemoveFavorite={removeFavorite} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Heart className="mx-auto h-16 w-16 text-muted-foreground opacity-20" />
                <h3 className="mt-4 text-lg font-medium">No favorites found</h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? 'No favorites match your search'
                    : 'Add some favorites by clicking the heart icon'}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="music" className="space-y-6">
            {audioFavorites.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {audioFavorites
                  .filter(
                    (file) =>
                      file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (file.artist &&
                        file.artist.toLowerCase().includes(searchQuery.toLowerCase())),
                  )
                  .map((file) => (
                    <MediaCard key={file.id} file={file} onRemoveFavorite={removeFavorite} />
                  ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Music className="mx-auto h-16 w-16 text-muted-foreground opacity-20" />
                <h3 className="mt-4 text-lg font-medium">No music favorites</h3>
                <p className="text-muted-foreground">Start adding your favorite music tracks</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos" className="space-y-6">
            {videoFavorites.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {videoFavorites
                  .filter(
                    (file) =>
                      file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (file.artist &&
                        file.artist.toLowerCase().includes(searchQuery.toLowerCase())),
                  )
                  .map((file) => (
                    <MediaCard key={file.id} file={file} onRemoveFavorite={removeFavorite} />
                  ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Film className="mx-auto h-16 w-16 text-muted-foreground opacity-20" />
                <h3 className="mt-4 text-lg font-medium">No video favorites</h3>
                <p className="text-muted-foreground">Start adding your favorite videos</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Favorites;
