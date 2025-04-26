
import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useMedia, MediaFile } from '@/contexts/MediaContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, Play, Music, Film, ListMusic, Search } from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

interface MediaCardProps {
  file: MediaFile;
  onRemoveFavorite: (id: string) => void;
}

const MediaCard: React.FC<MediaCardProps> = ({ file, onRemoveFavorite }) => {
  const { playFile } = useMedia();
  
  return (
    <Card className="group relative overflow-hidden">
      <div className="aspect-square">
        <img 
          src={file.cover || '/placeholder.svg'} 
          alt={file.title} 
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
        
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button 
            className="rounded-full bg-primary hover:bg-primary/90 w-12 h-12"
            onClick={() => playFile(file)}
          >
            <Play className="h-5 w-5 ml-0.5" />
          </Button>
          <Button 
            className="rounded-full bg-red-500/80 hover:bg-red-500 w-10 h-10"
            onClick={() => onRemoveFavorite(file.id)}
          >
            <Heart className="h-4 w-4 fill-current" />
          </Button>
        </div>
      </div>
      <div className="p-3">
        <p className="font-medium truncate">{file.title}</p>
        <p className="text-sm text-muted-foreground truncate">{file.artist || 'Unknown Artist'}</p>
      </div>
    </Card>
  );
};

const Favorites = () => {
  // In a real app, favorites would be stored in the state or database
  // For this demo, we're using the existing files as "favorites"
  const { files } = useMedia();
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<MediaFile[]>(files.slice(0, 5));
  
  const audioFavorites = favorites.filter(file => file.type === 'audio');
  const videoFavorites = favorites.filter(file => file.type === 'video');
  
  const removeFavorite = (id: string) => {
    setFavorites(prev => prev.filter(file => file.id !== id));
  };
  
  const filteredFavorites = favorites.filter(file => 
    file.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (file.artist && file.artist.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1 flex items-center gap-2">
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
          <TabsList className="grid grid-cols-3 w-[300px] mb-6">
            <TabsTrigger value="all">All ({favorites.length})</TabsTrigger>
            <TabsTrigger value="music">Music ({audioFavorites.length})</TabsTrigger>
            <TabsTrigger value="videos">Videos ({videoFavorites.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-6">
            {filteredFavorites.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {filteredFavorites.map(file => (
                  <MediaCard key={file.id} file={file} onRemoveFavorite={removeFavorite} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Heart className="h-16 w-16 mx-auto text-muted-foreground opacity-20" />
                <h3 className="mt-4 text-lg font-medium">No favorites found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'No favorites match your search' : 'Add some favorites by clicking the heart icon'}
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="music" className="space-y-6">
            {audioFavorites.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {audioFavorites
                  .filter(file => 
                    file.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (file.artist && file.artist.toLowerCase().includes(searchQuery.toLowerCase()))
                  )
                  .map(file => (
                    <MediaCard key={file.id} file={file} onRemoveFavorite={removeFavorite} />
                  ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Music className="h-16 w-16 mx-auto text-muted-foreground opacity-20" />
                <h3 className="mt-4 text-lg font-medium">No music favorites</h3>
                <p className="text-muted-foreground">
                  Start adding your favorite music tracks
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="videos" className="space-y-6">
            {videoFavorites.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {videoFavorites
                  .filter(file => 
                    file.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (file.artist && file.artist.toLowerCase().includes(searchQuery.toLowerCase()))
                  )
                  .map(file => (
                    <MediaCard key={file.id} file={file} onRemoveFavorite={removeFavorite} />
                  ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Film className="h-16 w-16 mx-auto text-muted-foreground opacity-20" />
                <h3 className="mt-4 text-lg font-medium">No video favorites</h3>
                <p className="text-muted-foreground">
                  Start adding your favorite videos
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Favorites;
