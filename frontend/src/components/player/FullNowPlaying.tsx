import React, { useEffect, useState, useMemo } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import {
  Play, Pause, SkipBack, SkipForward, ChevronDown,
  Shuffle, Repeat, Heart, ListMusic, Mic, Volume2,
  Share2, MoreHorizontal, Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { WaveformSeekBar } from './WaveformSeekBar';

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
    setAiDjEnabled
  } = usePlayerStore();
  const { files } = useLibraryStore();
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    if (currentFile?.id) {
       const apiBase = (window as any).API_BASE ?? 'http://localhost:3001';
       fetch(`${apiBase}/api/recommendations/${currentFile.id}?limit=5`)
         .then(res => res.json())
         .then(data => setRecommendations(data))
         .catch(e => console.error('Failed to fetch recommendations', e));
    }
  }, [currentFile?.id]);

  if (!currentFile) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-500">
      {/* Dynamic Background */}
      <div
        className="absolute inset-0 z-0 opacity-40 blur-[100px] saturate-150 transition-all duration-1000"
        style={{
          background: `radial-gradient(circle at center, ${currentFile.color || '#8B5CF6'} 0%, transparent 70%)`
        }}
      />

      <div className="relative z-10 flex flex-col h-full max-w-5xl mx-auto w-full px-6 py-12">
        <header className="flex justify-between items-center mb-8">
          <Button variant="ghost" size="icon" onClick={() => setPlayerFullscreen(false)}>
            <ChevronDown size={32} />
          </Button>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Playing from Library</p>
            <p className="text-sm font-semibold truncate max-w-[200px]">{currentFile.album || 'Unknown Album'}</p>
          </div>
          <Button variant="ghost" size="icon">
            <MoreHorizontal size={24} />
          </Button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center gap-12 min-h-0">
          <div className="relative group aspect-square w-full max-w-[400px]">
            <img
              src={currentFile.cover || '/placeholder.svg'}
              alt={currentFile.title}
              className={cn(
                "w-full h-full object-cover rounded-2xl shadow-2xl transition-transform duration-[4s] ease-in-out",
                isPlaying ? "scale-105" : "scale-100"
              )}
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
               <AudioVisualizer mode="circular" className="w-64 h-64" />
            </div>
          </div>

          <div className="w-full space-y-2 text-center">
            <h2 className="text-4xl md:text-5xl font-bold truncate px-4">{currentFile.title}</h2>
            <p className="text-xl md:text-2xl text-muted-foreground truncate px-4">{currentFile.artist}</p>
          </div>

          {recommendations.length > 0 && (
            <div className="w-full mt-8 overflow-hidden">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 text-left">More Like This</p>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                 {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex-shrink-0 w-32 cursor-pointer group"
                      onClick={() => {
                        const file = files.find(f => f.id === rec.id);
                        if (file) usePlayerStore.getState().playFile(file);
                      }}
                    >
                       <img
                         src={rec.cover || '/placeholder.svg'}
                         alt={rec.title}
                         className="w-32 h-32 object-cover rounded-lg shadow-md group-hover:scale-105 transition-transform"
                       />
                       <p className="text-xs font-semibold mt-2 truncate">{rec.title}</p>
                       <p className="text-[10px] text-muted-foreground truncate">{rec.artist}</p>
                    </div>
                 ))}
              </div>
            </div>
          )}
        </main>

        <footer className="mt-auto space-y-8">
          <div className="space-y-4">
            <WaveformSeekBar />
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShuffle(!shuffle)}
              className={cn(shuffle && "text-primary")}
            >
              <Shuffle size={24} />
            </Button>

            <div className="flex items-center gap-8">
              <Button variant="ghost" size="icon" className="h-12 w-12" onClick={() => previousTrack(files)}>
                <SkipBack size={32} fill="currentColor" />
              </Button>
              <Button
                size="icon"
                onClick={togglePlayback}
                className="h-20 w-20 rounded-full bg-foreground text-background hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-2" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-12 w-12" onClick={() => nextTrack(files)}>
                <SkipForward size={32} fill="currentColor" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRepeat(!repeat)}
              className={cn(repeat && "text-primary")}
            >
              <Repeat size={24} />
            </Button>
          </div>

          <div className="flex items-center justify-between text-muted-foreground">
             <div className="flex gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(aiDjEnabled && "text-purple-400")}
                  onClick={() => setAiDjEnabled(!aiDjEnabled)}
                  title="AI DJ"
                >
                  <Mic size={20} />
                </Button>
                <Button variant="ghost" size="icon"><ListMusic size={20} /></Button>
             </div>

             <div className="flex items-center gap-4 w-48">
                <Volume2 size={20} />
                <Slider
                  value={[volume * 100]}
                  max={100}
                  onValueChange={(v) => setVolume(v[0] / 100)}
                />
             </div>

             <div className="flex gap-4">
                <Button variant="ghost" size="icon"><Moon size={20} /></Button>
                <Button variant="ghost" size="icon"><Share2 size={20} /></Button>
             </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
