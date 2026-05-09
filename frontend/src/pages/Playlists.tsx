import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { Playlist } from '@/types/media';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Play, ListMusic, MoreHorizontal, Plus, Music, Film } from 'lucide-react';

const PlaylistCard: React.FC<{ playlist: Playlist }> = ({ playlist }) => {
  const { playFile } = usePlayerStore();

  const handlePlayPlaylist = () => {
    if (playlist.files.length > 0) {
      playFile(playlist.files[0]);
    }
  };

  return (
    <Card className="group overflow-hidden bg-card transition-colors hover:bg-card/80">
      <div className="relative aspect-square overflow-hidden bg-muted p-2">
        <div className="grid h-full grid-cols-2 gap-1">
          {playlist.files.slice(0, 4).map((file, index) => (
            <div key={index} className="overflow-hidden">
              <img
                src={file.cover || '/placeholder.svg'}
                alt={file.title}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
          {Array.from({ length: Math.max(0, 4 - playlist.files.length) }).map((_, index) => (
            <div key={`empty-${index}`} className="flex items-center justify-center bg-secondary">
              <ListMusic className="h-6 w-6 text-muted-foreground" />
            </div>
          ))}
        </div>

        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
            onClick={handlePlayPlaylist}
            disabled={playlist.files.length === 0}
          >
            <Play className="ml-0.5 h-5 w-5" />
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
  const { playlists, createPlaylist } = useLibraryStore();
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
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h1 className="text-3xl font-bold tracking-tight">Your Playlists</h1>
          <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" /> New Playlist
          </Button>
        </div>

        {playlists.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {playlists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ListMusic className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">No Playlists Yet</h2>
            <p className="mb-4 text-muted-foreground">
              Create your first playlist to organize your media
            </p>
            <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4" /> Create Playlist
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Playlist</DialogTitle>
            <DialogDescription>Give your playlist a name to get started.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Playlist Name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePlaylist}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Playlists;
