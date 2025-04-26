
import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useMedia, Playlist } from '@/contexts/MediaContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Play, ListMusic, MoreHorizontal, Plus, Music, Film } from 'lucide-react';

const PlaylistCard: React.FC<{ playlist: Playlist }> = ({ playlist }) => {
  const { playFile } = useMedia();
  
  const handlePlayPlaylist = () => {
    if (playlist.files.length > 0) {
      playFile(playlist.files[0]);
    }
  };
  
  return (
    <Card className="group overflow-hidden bg-card hover:bg-card/80 transition-colors">
      <div className="relative aspect-square overflow-hidden bg-muted p-2">
        <div className="grid grid-cols-2 gap-1 h-full">
          {playlist.files.slice(0, 4).map((file, index) => (
            <div key={index} className="overflow-hidden">
              <img 
                src={file.cover || '/placeholder.svg'} 
                alt={file.title} 
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          {Array.from({ length: Math.max(0, 4 - playlist.files.length) }).map((_, index) => (
            <div key={`empty-${index}`} className="bg-secondary flex items-center justify-center">
              <ListMusic className="text-muted-foreground h-6 w-6" />
            </div>
          ))}
        </div>
        
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button 
            className="rounded-full bg-primary hover:bg-primary/90 w-12 h-12"
            onClick={handlePlayPlaylist}
            disabled={playlist.files.length === 0}
          >
            <Play className="h-5 w-5 ml-0.5" />
          </Button>
        </div>
      </div>
      <div className="p-3">
        <p className="font-medium">{playlist.name}</p>
        <p className="text-sm text-muted-foreground">{playlist.files.length} items</p>
      </div>
    </Card>
  );
};

const Playlists = () => {
  const { playlists, createPlaylist } = useMedia();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  
  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setIsModalOpen(false);
    }
  };
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Your Playlists</h1>
          <Button 
            className="gap-2"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-4 w-4" /> New Playlist
          </Button>
        </div>
        
        {playlists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {playlists.map(playlist => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ListMusic className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Playlists Yet</h2>
            <p className="text-muted-foreground mb-4">Create your first playlist to organize your media</p>
            <Button 
              className="gap-2"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="h-4 w-4" /> Create Playlist
            </Button>
          </div>
        )}
      </div>
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Playlist</DialogTitle>
            <DialogDescription>
              Give your playlist a name to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              placeholder="Playlist Name" 
              value={newPlaylistName} 
              onChange={(e) => setNewPlaylistName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePlaylist}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Playlists;
