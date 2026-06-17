import React, { useEffect, useState, useRef } from 'react';
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
  VolumeX,
  Volume1,
  Share2,
  MoreHorizontal,
  Moon,
  Heart,
  Plus,
  Palette,
  SkipBack as StepBack,
  SkipForward as StepForward,
  Download,
  Headphones,
  Music2,
  Clock,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn, API_BASE, formatDuration } from '@/lib/utils';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { WaveformSeekBar } from './WaveformSeekBar';
import { type MediaFile } from '@/types/media';
import { CompressorControls } from './CompressorControls';
import { EqualizerControls } from './EqualizerControls';
import SpatialAudioControls from '../SpatialAudioControls';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    playbackEngine: pe,
  } = usePlayerStore();

  const { files } = useLibraryStore();
  const [recommendations, setRecommendations] = useState<MediaFile[]>([]);
  const [chapters, setChapters] = useState<{ time: number; title: string }[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  const [showQueue, setShowQueue] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'lyrics' | 'queue'>('info');
  const [dominantColor, setDominantColor] = useState('rgba(139, 92, 246, 0.3)');

  useEffect(() => {
    if (currentFile?.metadata_json) {
      try {
        const meta = JSON.parse(currentFile.metadata_json);
        setChapters(meta.chapters || []);
      } catch (e) {
        setChapters([]);
      }
    }
  }, [currentFile]);

  useEffect(() => {
    if (currentFile?.id) {
      fetch(`${API_BASE}/api/recommendations/${currentFile.id}?limit=5`)
        .then((res) => res.json())
        .then((data: IncomingTrack[]) => {
          setRecommendations(data.map(mapIncomingTrackToMediaFile));
        })
        .catch(() => {});
    }
  }, [currentFile?.id]);

  if (!currentFile) return null;

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(prevVolume || 0.8);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      setVolume(0);
    }
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed inset-0 z-50 flex overflow-hidden bg-black text-white duration-500 animate-in slide-in-from-bottom">
        {/* Ambient background */}
        <div className="absolute inset-0 z-0">
          <div
            className="duration-2000 absolute inset-[-60px] scale-110 bg-cover bg-center transition-all"
            style={{
              backgroundImage: `url(${currentFile.cover || '/placeholder.svg'})`,
              filter: 'blur(80px) saturate(1.5)',
              opacity: 0.4,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
        </div>

        {/* Main content */}
        <div className="relative z-10 flex h-full w-full">
          {/* Left panel - Album art + controls */}
          <div className="flex flex-1 flex-col px-8 py-6 md:px-16 md:py-12">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
                    onClick={() => setPlayerFullscreen(false)}
                  >
                    <ChevronDown size={24} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Minimize</TooltipContent>
              </Tooltip>

              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Now Playing
                </p>
                <p className="max-w-[200px] truncate text-sm font-semibold text-white/80">
                  {currentFile.album || 'Unknown Album'}
                </p>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
                  >
                    <MoreHorizontal size={20} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-52 border-white/10 bg-zinc-900/95 text-white backdrop-blur-xl"
                  align="end"
                >
                  <div className="space-y-1">
                    {[
                      { icon: Download, label: 'Download' },
                      { icon: Share2, label: 'Share' },
                      { icon: Music2, label: 'Go to Album' },
                      { icon: Headphones, label: 'Go to Artist' },
                    ].map(({ icon: Icon, label }) => (
                      <button
                        key={label}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <Icon size={16} />
                        {label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Album art */}
            <div className="mx-auto mb-8 w-full max-w-sm flex-shrink-0 md:max-w-md">
              <div className="group relative aspect-square">
                <img
                  src={currentFile.cover || '/placeholder.svg'}
                  alt={currentFile.title}
                  className={cn(
                    'h-full w-full rounded-2xl object-cover shadow-2xl ring-1 ring-white/10 transition-all duration-700',
                    isPlaying ? 'scale-100 shadow-purple-500/20' : 'scale-95 opacity-90',
                  )}
                  style={{
                    boxShadow: isPlaying
                      ? '0 32px 80px -16px rgba(139,92,246,0.4)'
                      : '0 24px 48px -12px rgba(0,0,0,0.6)',
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl opacity-0 transition-opacity group-hover:opacity-100">
                  <AudioVisualizer mode="circular" className="h-48 w-48" />
                </div>
              </div>
            </div>

            {/* Track info + actions */}
            <div className="mb-6 flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="mb-1 truncate text-2xl font-bold text-white md:text-3xl">
                  {currentFile.title}
                </h2>
                <button className="truncate text-base text-white/60 transition-colors hover:text-white">
                  {currentFile.artist}
                </button>
                <div className="mt-1 flex items-center gap-2">
                  {currentFile.camelot_key && (
                    <span className="rounded border border-purple-500/30 bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                      {currentFile.camelot_key}
                    </span>
                  )}
                  {currentFile.bpm && (
                    <span className="flex items-center gap-1 text-[10px] text-white/40">
                      <Zap size={10} />
                      {Math.round(currentFile.bpm)} BPM
                    </span>
                  )}
                  {currentFile.genre && (
                    <span className="text-[10px] text-white/40">{currentFile.genre}</span>
                  )}
                </div>
              </div>

              <div className="ml-4 flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-10 w-10 rounded-full',
                        isFavorite
                          ? 'text-red-400 hover:text-red-300'
                          : 'text-white/50 hover:text-white',
                      )}
                      onClick={() => setIsFavorite(!isFavorite)}
                    >
                      <Heart size={22} fill={isFavorite ? 'currentColor' : 'none'} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-full text-white/50 hover:text-white"
                    >
                      <Plus size={22} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add to playlist</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Waveform seekbar */}
            <div className="mb-6">
              <WaveformSeekBar trackId={currentFile.id} />
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-10 w-10 rounded-full text-white/60 hover:text-white',
                      shuffle && 'text-purple-400 hover:text-purple-300',
                    )}
                    onClick={() => setShuffle(!shuffle)}
                  >
                    <Shuffle size={20} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Shuffle {shuffle ? 'On' : 'Off'}</TooltipContent>
              </Tooltip>

              <div className="flex items-center gap-6">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-full text-white hover:bg-white/10"
                  onClick={() => previousTrack()}
                >
                  <SkipBack size={28} fill="currentColor" />
                </Button>

                <Button
                  size="icon"
                  onClick={togglePlayback}
                  className="h-16 w-16 rounded-full bg-white text-black shadow-2xl transition-transform hover:scale-105 hover:bg-white/90"
                >
                  {isPlaying ? (
                    <Pause size={32} fill="currentColor" />
                  ) : (
                    <Play size={32} fill="currentColor" className="ml-1" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-full text-white hover:bg-white/10"
                  onClick={() => nextTrack()}
                >
                  <SkipForward size={28} fill="currentColor" />
                </Button>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-10 w-10 rounded-full text-white/60 hover:text-white',
                      repeat && 'text-purple-400 hover:text-purple-300',
                    )}
                    onClick={() => setRepeat(!repeat)}
                  >
                    <Repeat size={20} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Repeat {repeat ? 'On' : 'Off'}</TooltipContent>
              </Tooltip>
            </div>

            {/* Footer controls */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-9 w-9 rounded-full text-white/50 hover:text-white',
                        aiDjEnabled && 'text-purple-400 hover:text-purple-300',
                      )}
                      onClick={() => setAiDjEnabled(!aiDjEnabled)}
                    >
                      <Mic size={18} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>AI DJ {aiDjEnabled ? 'On' : 'Off'}</TooltipContent>
                </Tooltip>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-white/50 hover:text-white"
                    >
                      <Palette size={18} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-96 border-white/10 bg-zinc-900/95 p-0 backdrop-blur-xl"
                    side="top"
                  >
                    <div className="custom-scrollbar max-h-[60vh] space-y-6 overflow-y-auto p-4">
                      <EqualizerControls onClose={() => {}} />
                      <CompressorControls />
                      <SpatialAudioControls />
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-9 w-9 rounded-full text-white/50 hover:text-white',
                      pe.sleepTimer?.getState().active && 'text-amber-400',
                    )}
                  >
                    <Moon size={18} />
                  </Button>
                  {pe.sleepTimer?.getState().active && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-bold text-black">
                      {Math.ceil(pe.sleepTimer.getState().remainingSeconds / 60)}m
                    </span>
                  )}
                </div>
              </div>

              <div className="flex w-36 items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 text-white/50 hover:text-white"
                  onClick={toggleMute}
                >
                  <VolumeIcon size={16} />
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume * 100]}
                  max={100}
                  onValueChange={(v) => {
                    setVolume(v[0] / 100);
                    if (v[0] > 0) setIsMuted(false);
                  }}
                />
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-white/50 hover:text-white"
                    onClick={() => setShowQueue(!showQueue)}
                  >
                    <ListMusic size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Queue</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Right panel - Recommendations */}
          {recommendations.length > 0 && (
            <div className="hidden w-72 flex-col gap-3 overflow-y-auto border-l border-white/10 p-6 lg:flex">
              <p className="text-xs font-bold uppercase tracking-widest text-white/40">Up Next</p>
              <div className="space-y-2">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="group flex cursor-pointer items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/10"
                    onClick={() => {
                      const file = files.find((f) => f.id === rec.id);
                      if (file) usePlayerStore.getState().playFile(file);
                    }}
                  >
                    <img
                      src={rec.cover || '/placeholder.svg'}
                      alt={rec.title}
                      className="h-12 w-12 flex-shrink-0 rounded-lg object-cover shadow-md transition-transform group-hover:scale-105"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">{rec.title}</p>
                      <p className="truncate text-[10px] text-white/50">{rec.artist}</p>
                    </div>
                    <Play
                      size={14}
                      className="flex-shrink-0 text-white/0 transition-colors group-hover:text-white/60"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
