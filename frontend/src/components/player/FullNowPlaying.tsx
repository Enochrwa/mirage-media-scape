import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import {
  useLibraryStore,
  mapIncomingTrackToMediaFile,
  type IncomingTrack,
} from '@/store/useLibraryStore';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  Shuffle,
  Repeat,
  ListMusic,
  Mic,
  Volume2,
  Share2,
  MoreHorizontal,
  Moon,
  Heart,
  Plus,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn, API_BASE } from '@/lib/utils';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { WaveformSeekBar } from './WaveformSeekBar';
import { type MediaFile } from '@/types/media';

export const FullNowPlaying: React.FC = () => {
  const {
    currentFile,
    isPlaying,
    togglePlayback,
    currentTime,
    duration,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    nextTrack,
    previousTrack,
    setPlayerFullscreen,
    volume,
    setVolume,
    aiDjEnabled,
    setAiDjEnabled,
  } = usePlayerStore();
  const { files } = useLibraryStore();
  const [recommendations, setRecommendations] = useState<MediaFile[]>([]);

  useEffect(() => {
    if (currentFile?.id) {
      fetch(`${API_BASE}/api/recommendations/${currentFile.id}?limit=5`)
        .then((res) => res.json())
        .then((data: IncomingTrack[]) => {
          const mapped = data.map(mapIncomingTrackToMediaFile);
          setRecommendations(mapped);
        })
        .catch((e) => console.error('Failed to fetch recommendations', e));
    }
  }, [currentFile?.id]);

  if (!currentFile) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background text-foreground duration-500 animate-in slide-in-from-bottom">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-[-50px] z-0 scale-110 bg-cover bg-center transition-all duration-1000"
          style={{
            backgroundImage: `url(${currentFile.cover || '/placeholder.svg'})`,
            filter: 'blur(60px)',
          }}
        />
        <div className="absolute inset-0 z-10 bg-black/40" />
      </div>

      <div className="relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col px-6 py-12">
        <header className="mb-8 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setPlayerFullscreen(false)}>
            <ChevronDown size={32} />
          </Button>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Playing from Library
            </p>
            <p className="max-w-[200px] truncate text-sm font-semibold">
              {currentFile.album || 'Unknown Album'}
            </p>
          </div>
          <Button variant="ghost" size="icon">
            <MoreHorizontal size={24} />
          </Button>
        </header>

        <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-12">
          <div className="group relative aspect-square w-full max-w-[400px]">
            <img
              src={currentFile.cover || '/placeholder.svg'}
              alt={currentFile.title}
              className={cn(
                'duration-[4s] h-full w-full rounded-2xl object-cover shadow-2xl transition-transform ease-in-out',
                isPlaying ? 'scale-105' : 'scale-100',
              )}
            />
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
              <AudioVisualizer mode="circular" className="h-64 w-64" />
            </div>
          </div>

          <div className="w-full space-y-2 text-center">
            <h2 className="truncate px-4 text-4xl font-bold md:text-5xl">{currentFile.title}</h2>
            <div className="flex flex-col items-center">
              <button className="truncate px-4 text-xl text-muted-foreground transition-colors hover:text-foreground md:text-2xl">
                {currentFile.artist}
              </button>
              <button className="truncate px-4 text-sm text-muted-foreground/60 transition-colors hover:text-foreground md:text-base">
                {currentFile.album}
              </button>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-2xl items-center justify-around py-2">
            <Button variant="ghost" size="icon" className="hover:text-primary" title="Like">
              <Heart size={20} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hover:text-primary"
              title="Add to Playlist"
            >
              <Plus size={20} />
            </Button>
            <Button variant="ghost" size="icon" className="hover:text-primary" title="Lyrics">
              <ListMusic size={20} />
            </Button>
            <Button variant="ghost" size="icon" className="hover:text-primary" title="Visualizer">
              <Palette size={20} />
            </Button>
            <Button variant="ghost" size="icon" className="hover:text-primary" title="Sleep Timer">
              <Moon size={20} />
            </Button>
            <Button variant="ghost" size="icon" className="hover:text-primary" title="Share">
              <Share2 size={20} />
            </Button>
            <Button variant="ghost" size="icon" className="hover:text-primary" title="More">
              <MoreHorizontal size={20} />
            </Button>
          </div>

          {recommendations.length > 0 && (
            <div className="mt-8 w-full overflow-hidden">
              <p className="mb-4 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">
                More Like This
              </p>
              <div className="no-scrollbar flex gap-4 overflow-x-auto pb-4">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="group w-32 flex-shrink-0 cursor-pointer"
                    onClick={() => {
                      const file = files.find((f) => f.id === rec.id);
                      if (file) usePlayerStore.getState().playFile(file);
                    }}
                  >
                    <img
                      src={rec.cover || '/placeholder.svg'}
                      alt={rec.title}
                      className="h-32 w-32 rounded-lg object-cover shadow-md transition-transform group-hover:scale-105"
                    />
                    <p className="mt-2 truncate text-xs font-semibold">{rec.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{rec.artist}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        <footer className="mt-auto space-y-8">
          <div className="space-y-4">
            <WaveformSeekBar trackId={currentFile.id} />
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShuffle(!shuffle)}
              className={cn(shuffle && 'text-primary')}
            >
              <Shuffle size={24} />
            </Button>

            <div className="flex items-center gap-8">
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12"
                onClick={() => previousTrack()}
              >
                <SkipBack size={32} fill="currentColor" />
              </Button>
              <Button
                size="icon"
                onClick={togglePlayback}
                className="h-20 w-20 rounded-full bg-foreground text-background transition-transform hover:scale-105"
              >
                {isPlaying ? (
                  <Pause size={40} fill="currentColor" />
                ) : (
                  <Play size={40} fill="currentColor" className="ml-2" />
                )}
              </Button>
              <Button variant="ghost" size="icon" className="h-12 w-12" onClick={() => nextTrack()}>
                <SkipForward size={32} fill="currentColor" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRepeat(!repeat)}
              className={cn(repeat && 'text-primary')}
            >
              <Repeat size={24} />
            </Button>
          </div>

          <div className="flex items-center justify-between text-muted-foreground">
            <div className="flex gap-4">
              <Button
                variant="ghost"
                size="icon"
                className={cn(aiDjEnabled && 'text-purple-400')}
                onClick={() => setAiDjEnabled(!aiDjEnabled)}
                title="AI DJ"
              >
                <Mic size={20} />
              </Button>
            </div>

            <div className="flex w-48 items-center gap-4">
              <Volume2 size={20} />
              <Slider
                value={[volume * 100]}
                max={100}
                onValueChange={(v) => setVolume(v[0] / 100)}
              />
            </div>

            <div className="w-10" />
          </div>
        </footer>
      </div>
    </div>
  );
};
