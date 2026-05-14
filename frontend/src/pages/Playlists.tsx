import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { Playlist } from '@/types/media';
import { API_BASE } from '@/lib/utils';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Play, ListMusic, MoreHorizontal, Plus, Music, Film, Sparkles } from 'lucide-react';

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
  const { playlists, createPlaylist, smartPlaylists, fetchSmartPlaylists } = useLibraryStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const [smartDefinition, setSmartDefinition] = useState({
    matchMode: 'all' as 'all' | 'any',
    conditions: [{ field: 'artist', operator: 'contains', value: '' }],
  });

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setIsModalOpen(false);
    }
  };

  const handleCreateSmartPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/playlists/smart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlaylistName.trim(),
          definition: JSON.stringify(smartDefinition),
        }),
      });
      if (res.ok) {
        setNewPlaylistName('');
        setIsSmartModalOpen(false);
        fetchSmartPlaylists();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-12">
        <div className="space-y-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <h1 className="text-3xl font-bold tracking-tight">Your Playlists</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                onClick={() => setIsSmartModalOpen(true)}
              >
                <Sparkles className="h-4 w-4" /> New Smart Playlist
              </Button>
              <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" /> New Playlist
              </Button>
            </div>
          </div>

          {playlists.length > 0 || smartPlaylists.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {smartPlaylists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
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
      </div>

      <Dialog open={isSmartModalOpen} onOpenChange={setIsSmartModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              Create Smart Playlist
            </DialogTitle>
            <DialogDescription>
              Tracks will be added automatically based on these rules.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Playlist Name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
            />

            <div className="flex items-center gap-2 text-sm">
              <span>Match</span>
              <Select
                value={smartDefinition.matchMode}
                onValueChange={(v: 'all' | 'any') =>
                  setSmartDefinition((prev) => ({ ...prev, matchMode: v }))
                }
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="any">Any</SelectItem>
                </SelectContent>
              </Select>
              <span>of the following rules:</span>
            </div>

            {smartDefinition.conditions.map((cond, i) => (
              <div key={i} className="flex gap-2">
                <Select
                  value={cond.field}
                  onValueChange={(v) => {
                    const newConds = [...smartDefinition.conditions];
                    newConds[i].field = v;
                    setSmartDefinition((prev) => ({ ...prev, conditions: newConds }));
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="artist">Artist</SelectItem>
                    <SelectItem value="album">Album</SelectItem>
                    <SelectItem value="genre">Genre</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                    <SelectItem value="bpm">BPM</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={cond.operator}
                  onValueChange={(v) => {
                    const newConds = [...smartDefinition.conditions];
                    newConds[i].operator = v;
                    setSmartDefinition((prev) => ({ ...prev, conditions: newConds }));
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="is">Is</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="gt">Greater than</SelectItem>
                    <SelectItem value="lt">Less than</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  className="flex-1"
                  value={cond.value as string}
                  onChange={(e) => {
                    const newConds = [...smartDefinition.conditions];
                    newConds[i].value = e.target.value;
                    setSmartDefinition((prev) => ({ ...prev, conditions: newConds }));
                  }}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSmartModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSmartPlaylist}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              Create Smart Playlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
