import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Repeat1,
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
  Download,
  Headphones,
  Music2,
  Zap,
  ChevronsLeft,
  ChevronsRight,
  X,
  Disc3,
  Check,
  GripVertical,
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
import { queueManager } from '@/engines/QueueManager';
import { useTrackFavorite } from '@/hooks/useTrackFavorite';
import { useRadioNowPlaying } from '@/hooks/useRadioNowPlaying';
import { toast } from '@/hooks/use-toast';

type Tab = 'lyrics' | 'queue' | 'info';

export const FullNowPlaying: React.FC = () => {
  const {
    currentFile,
    isPlaying,
    togglePlayback,
    currentTime,
    duration,
    shuffle,
    setShuffle,
    repeatMode,
    cycleRepeat,
    nextTrack,
    previousTrack,
    setPlayerFullscreen,
    volume,
    setVolume,
    aiDjEnabled,
    setAiDjEnabled,
    playbackEngine: pe,
    closePlayer,
  } = usePlayerStore();

  const { files, playlists, addToPlaylist } = useLibraryStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isRadio = Boolean(currentFile?.isStream) || currentFile?.album === 'Radio';
  const { isFavorite, toggle: toggleFavorite } = useTrackFavorite(
    currentFile && !isRadio ? currentFile.id : undefined,
  );
  const { nowPlayingTitle, isReconnecting } = useRadioNowPlaying(currentFile);

  // Auto-minimise when user navigates to another page
  useEffect(() => {
    setPlayerFullscreen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  const [recommendations, setRecommendations] = useState<MediaFile[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [queue, setQueue] = useState<MediaFile[]>([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showEQ, setShowEQ] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [addedToPlaylistId, setAddedToPlaylistId] = useState<string | null>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);

  /* ── colour extraction ── */
  const [accentColor, setAccentColor] = useState('#8b5cf6');

  useEffect(() => {
    if (!currentFile?.cover) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentFile.cover;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      // Boost saturation so it's vivid
      setAccentColor(`rgb(${r},${g},${b})`);
    };
  }, [currentFile?.cover]);

  /* ── queue sync ── */
  useEffect(() => {
    const sync = () => {
      setQueue(queueManager.getQueue());
      setQueueIdx(queueManager.getCurrentIndex());
    };
    sync();
    const unsub = queueManager.addListener(sync);
    return () => unsub();
  }, []);

  /* ── recommendations (skipped for radio — station ids have no track row) ── */
  useEffect(() => {
    if (!currentFile?.id || isRadio) {
      setRecommendations([]);
      return;
    }
    fetch(`${API_BASE}/api/recommendations/${currentFile.id}?limit=6`)
      .then((r) => r.json())
      .then((data: IncomingTrack[]) => setRecommendations(data.map(mapIncomingTrackToMediaFile)))
      .catch(() => {});
  }, [currentFile?.id, isRadio]);

  /* ── lyrics scroll ── */
  useEffect(() => {
    if (activeTab !== 'lyrics' || !lyricsRef.current || lyrics.length === 0) return;
    const idx = lyrics.reduce((best, l, i) => (l.time <= currentTime ? i : best), -1);
    if (idx >= 0) {
      const el = lyricsRef.current.children[idx] as HTMLElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime, activeTab, lyrics]);

  /* ── lyrics tab isn't offered for radio; bail out of it if a station
     starts playing while it's active so the tab content area isn't left
     blank ── */
  useEffect(() => {
    if (isRadio && activeTab === 'lyrics') setActiveTab('info');
  }, [isRadio, activeTab]);

  /* ── playback rate sync (no-op for radio — live streams ignore rate changes) ── */
  useEffect(() => {
    if (isRadio) return;
    pe.setPlaybackRate?.(playbackRate);
  }, [playbackRate, pe, isRadio]);

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
  const activeLyricIdx = lyrics.reduce((best, l, i) => (l.time <= currentTime ? i : best), -1);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="duration-400 fixed inset-0 z-[100] overflow-hidden text-white animate-in slide-in-from-bottom">
        {/* ── Ambient background ── */}
        <div className="absolute inset-0 z-0">
          <div
            className="absolute inset-[-80px] scale-110 bg-cover bg-center transition-all [transition-duration:3000ms]"
            style={{
              backgroundImage: `url(${currentFile.cover || '/placeholder.svg'})`,
              filter: 'blur(90px) saturate(2)',
              opacity: 0.35,
            }}
          />
          {/* Dark gradient layers */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/55 to-black/90" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />
        </div>

        {/* ── Layout ── */}
        <div className="relative z-10 flex h-full flex-col md:flex-row">
          {/* ════════════ LEFT / MAIN PANEL ════════════ */}
          <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-6 pt-4 md:overflow-hidden md:px-10 md:pb-8 md:pt-6">
            {/* Header row */}
            <div className="mb-5 flex flex-shrink-0 items-center justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
                    onClick={() => setPlayerFullscreen(false)}
                  >
                    <ChevronDown size={22} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Minimise</TooltipContent>
              </Tooltip>

              <div className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">
                  Now Playing
                </p>
                <p className="max-w-[240px] truncate text-sm font-semibold text-white/75">
                  {currentFile.album || 'Unknown Album'}
                </p>
              </div>

              <div className="flex items-center gap-1">
                {/* More menu */}
                <Popover
                  onOpenChange={(open) => {
                    if (!open) setShowPlaylistMenu(false);
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
                    >
                      <MoreHorizontal size={18} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-56 border-white/10 bg-zinc-900/95 p-1.5 text-white backdrop-blur-xl"
                    align="end"
                  >
                    {showPlaylistMenu ? (
                      <div>
                        <button
                          className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                          onClick={() => setShowPlaylistMenu(false)}
                        >
                          <ChevronDown size={13} className="rotate-90" /> Back
                        </button>
                        {playlists.length === 0 ? (
                          <p className="px-3 py-2.5 text-xs text-white/40">
                            No playlists yet — create one from the Library page.
                          </p>
                        ) : (
                          playlists.map((p) => (
                            <button
                              key={p.id}
                              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                              onClick={() => {
                                addToPlaylist(p.id, currentFile.id);
                                setAddedToPlaylistId(p.id);
                                toast({
                                  title: 'Added to playlist',
                                  description: `"${currentFile.title}" was added to "${p.name}".`,
                                });
                                setTimeout(() => setAddedToPlaylistId(null), 1500);
                              }}
                            >
                              <span className="truncate">{p.name}</span>
                              {addedToPlaylistId === p.id && (
                                <Check size={14} className="flex-shrink-0 text-emerald-400" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    ) : (
                      <>
                        {!isRadio && (
                          <button
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                            onClick={() => window.open(`${API_BASE}/api/stream/${currentFile.id}`)}
                          >
                            <Download size={15} /> Download
                          </button>
                        )}
                        <button
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                          onClick={async () => {
                            const shareData = {
                              title: currentFile.title,
                              text: isRadio
                                ? `Listening to ${currentFile.title} on Zovyra Radio`
                                : `Listening to "${currentFile.title}" by ${currentFile.artist || 'Unknown Artist'} on Zovyra`,
                              url: window.location.href,
                            };
                            try {
                              if (navigator.share) {
                                await navigator.share(shareData);
                              } else {
                                await navigator.clipboard.writeText(
                                  `${shareData.text} — ${shareData.url}`,
                                );
                                toast({ title: 'Link copied to clipboard' });
                              }
                            } catch {
                              // Share cancelled by user — not an error
                            }
                          }}
                        >
                          <Share2 size={15} /> Share
                        </button>
                        {!isRadio && currentFile.album && (
                          <button
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                            onClick={() =>
                              navigate(`/album/${encodeURIComponent(currentFile.album!)}`)
                            }
                          >
                            <Music2 size={15} /> Go to Album
                          </button>
                        )}
                        {!isRadio && currentFile.artist && (
                          <button
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                            onClick={() =>
                              navigate(`/artist/${encodeURIComponent(currentFile.artist!)}`)
                            }
                          >
                            <Headphones size={15} /> Go to Artist
                          </button>
                        )}
                        {!isRadio && (
                          <button
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                            onClick={() => setShowPlaylistMenu(true)}
                          >
                            <Plus size={15} /> Add to Playlist
                          </button>
                        )}
                        <div className="my-1.5 border-t border-white/10" />
                        <button
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          onClick={closePlayer}
                        >
                          <X size={15} /> {isRadio ? 'Stop & Close' : 'Close Player'}
                        </button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Album art — animated */}
            <div className="mx-auto mb-6 w-full max-w-[280px] flex-shrink-0 md:max-w-[340px]">
              <div className="group relative aspect-square">
                {/* Glow ring */}
                <div
                  className="absolute -inset-4 rounded-3xl opacity-40 blur-2xl transition-opacity duration-1000"
                  style={{ background: accentColor, opacity: isPlaying ? 0.45 : 0 }}
                />
                <div
                  className={cn(
                    'relative h-full w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 transition-all duration-700',
                    isPlaying ? 'scale-100' : 'scale-[0.94] opacity-80',
                  )}
                >
                  <img
                    src={currentFile.cover || '/placeholder.svg'}
                    alt={currentFile.title}
                    className="h-full w-full object-cover"
                  />
                  {/* Vinyl spin overlay on hover */}
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <div
                      className={cn(
                        'flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/20 bg-black/60',
                        isPlaying && 'animate-spin',
                      )}
                      style={{ animationDuration: '4s' }}
                    >
                      <Disc3 size={28} className="text-white/80" />
                    </div>
                  </div>
                </div>
                {/* Visualiser */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <AudioVisualizer mode="circular" className="pointer-events-none h-48 w-48" />
                </div>
              </div>
            </div>

            {/* Track meta */}
            <div className="mb-5 flex flex-shrink-0 items-start justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="mb-0.5 truncate text-2xl font-extrabold tracking-tight text-white md:text-[1.7rem]">
                  {isRadio && nowPlayingTitle ? nowPlayingTitle : currentFile.title}
                </h2>
                <button className="truncate text-base font-medium text-white/55 transition-colors hover:text-white">
                  {isRadio && nowPlayingTitle ? currentFile.title : currentFile.artist}
                </button>
                {isRadio && (
                  <div className="mt-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide',
                        isReconnecting
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-red-500/20 text-red-400',
                      )}
                    >
                      {isReconnecting ? '◌ RECONNECTING' : '● LIVE'}
                    </span>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {currentFile.camelot_key && (
                    <span className="rounded-full border border-purple-400/30 bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-purple-300">
                      {currentFile.camelot_key}
                    </span>
                  )}
                  {currentFile.bpm && (
                    <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-white/50">
                      <Zap size={9} /> {Math.round(currentFile.bpm)} BPM
                    </span>
                  )}
                  {currentFile.genre && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-white/40">
                      {currentFile.genre}
                    </span>
                  )}
                </div>
              </div>

              <div className="ml-4 flex items-center gap-1.5">
                {!isRadio && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-11 w-11 rounded-full transition-colors',
                          isFavorite
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-white/40 hover:text-white',
                        )}
                        onClick={() => void toggleFavorite()}
                      >
                        <Heart size={22} fill={isFavorite ? 'currentColor' : 'none'} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isFavorite ? 'Unfavorite' : 'Add to favourites'}
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-full text-white/40 hover:text-white"
                    >
                      <Plus size={22} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add to playlist</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Waveform + time */}
            <div className="mb-4 flex-shrink-0">
              <WaveformSeekBar trackId={currentFile.id} />
              {!isRadio && (
                <div className="mt-1 flex justify-between font-mono text-[11px] text-white/35">
                  <span>{formatDuration(currentTime)}</span>
                  <span>-{formatDuration(Math.max(0, duration - currentTime))}</span>
                </div>
              )}
            </div>

            {/* Main controls */}
            <div className="flex-shrink-0">
              {/* Speed selector — hidden for radio: changing playback rate on
                  a live stream just distorts pitch with no useful effect */}
              {!isRadio && (
                <div className="mb-3 flex items-center justify-center gap-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                    <button
                      key={r}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors',
                        playbackRate === r
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white',
                      )}
                      onClick={() => setPlaybackRate(r)}
                    >
                      {r === 1 ? '1×' : `${r}×`}
                    </button>
                  ))}
                </div>
              )}

              {isRadio && (
                <div className="mb-3 flex items-center justify-center">
                  <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-[11px] font-bold tracking-wide text-red-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                    LIVE BROADCAST
                  </span>
                </div>
              )}

              {/* Prev / -10 / Play / +10 / Next — radio only gets play/pause,
                  since there's no queue position, no rewind, and no "next"
                  on a live stream */}
              <div className="flex items-center justify-center gap-2 md:gap-4">
                {!isRadio && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-10 w-10 rounded-full text-white/60 hover:text-white',
                          shuffle && 'text-purple-400',
                        )}
                        onClick={() => setShuffle(!shuffle)}
                      >
                        <Shuffle size={19} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Shuffle</TooltipContent>
                  </Tooltip>
                )}

                {!isRadio && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full text-white hover:bg-white/10"
                    onClick={() => previousTrack()}
                  >
                    <SkipBack size={26} fill="currentColor" />
                  </Button>
                )}

                {!isRadio && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                        onClick={() =>
                          usePlayerStore.getState().seekTo(Math.max(0, currentTime - 10))
                        }
                      >
                        <ChevronsLeft size={22} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>−10s</TooltipContent>
                  </Tooltip>
                )}

                {/* Big play button */}
                <button
                  className="relative flex h-[70px] w-[70px] items-center justify-center rounded-full bg-white text-black shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ boxShadow: `0 0 40px ${accentColor}80` }}
                  onClick={togglePlayback}
                >
                  {isPlaying ? (
                    <Pause size={30} fill="currentColor" />
                  ) : (
                    <Play size={30} fill="currentColor" className="ml-1" />
                  )}
                </button>

                {!isRadio && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                        onClick={() =>
                          usePlayerStore.getState().seekTo(Math.min(duration, currentTime + 10))
                        }
                      >
                        <ChevronsRight size={22} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>+10s</TooltipContent>
                  </Tooltip>
                )}

                {!isRadio && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full text-white hover:bg-white/10"
                    onClick={() => nextTrack()}
                  >
                    <SkipForward size={26} fill="currentColor" />
                  </Button>
                )}

                {!isRadio && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-10 w-10 rounded-full text-white/60 hover:text-white',
                          repeatMode !== 'off' && 'text-purple-400',
                        )}
                        onClick={cycleRepeat}
                      >
                        {repeatMode === 'one' ? <Repeat1 size={19} /> : <Repeat size={19} />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {repeatMode === 'off' && 'Repeat off'}
                      {repeatMode === 'all' && 'Repeat all'}
                      {repeatMode === 'one' && 'Repeat one'}
                    </TooltipContent>
                  </Tooltip>
                )}

                {isRadio && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full text-white/60 hover:text-red-400"
                        onClick={closePlayer}
                      >
                        <X size={19} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Stop station</TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Volume + secondary tools */}
              <div className="mt-5 flex items-center justify-between gap-4">
                {/* Volume */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0 text-white/40 hover:text-white"
                    onClick={toggleMute}
                  >
                    <VolumeIcon size={15} />
                  </Button>
                  <div className="w-24 md:w-28">
                    <Slider
                      value={[isMuted ? 0 : volume * 100]}
                      max={100}
                      onValueChange={(v) => {
                        setVolume(v[0] / 100);
                        if (v[0] > 0) setIsMuted(false);
                      }}
                    />
                  </div>
                </div>

                {/* Tools cluster */}
                <div className="flex items-center gap-0.5">
                  {/* EQ / Audio FX */}
                  <Popover open={showEQ} onOpenChange={setShowEQ}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'h-9 w-9 rounded-full text-white/50 hover:text-white',
                              showEQ && 'text-purple-400',
                            )}
                          >
                            <Palette size={17} />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Audio FX</TooltipContent>
                    </Tooltip>
                    <PopoverContent
                      className="w-96 border-white/10 bg-zinc-900/95 p-0 backdrop-blur-2xl"
                      side="top"
                    >
                      <div className="custom-scrollbar max-h-[60vh] space-y-4 overflow-y-auto p-4">
                        <EqualizerControls onClose={() => setShowEQ(false)} />
                        <CompressorControls />
                        <SpatialAudioControls />
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* AI DJ */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-9 w-9 rounded-full text-white/50 hover:text-white',
                          aiDjEnabled && 'text-purple-400',
                        )}
                        onClick={() => setAiDjEnabled(!aiDjEnabled)}
                      >
                        <Mic size={17} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>AI DJ {aiDjEnabled ? 'On' : 'Off'}</TooltipContent>
                  </Tooltip>

                  {/* Sleep timer */}
                  <div className="relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-9 w-9 rounded-full text-white/50 hover:text-white',
                            pe.sleepTimer?.getState().active && 'text-amber-400',
                          )}
                        >
                          <Moon size={17} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Sleep Timer</TooltipContent>
                    </Tooltip>
                    {pe.sleepTimer?.getState().active && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-black text-black">
                        {Math.ceil(pe.sleepTimer.getState().remainingSeconds / 60)}m
                      </span>
                    )}
                  </div>

                  {/* Queue */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-9 w-9 rounded-full text-white/50 hover:text-white',
                          activeTab === 'queue' && 'text-purple-400',
                        )}
                        onClick={() => setActiveTab(activeTab === 'queue' ? 'info' : 'queue')}
                      >
                        <ListMusic size={17} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Queue</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          {/* ════════════ RIGHT PANEL ════════════ */}
          <div className="border-white/8 hidden w-[300px] flex-shrink-0 flex-col border-l bg-black/20 backdrop-blur-sm lg:flex xl:w-[340px]">
            {/* Tabs */}
            <div className="border-white/8 flex flex-shrink-0 border-b">
              {(isRadio
                ? (['info', 'queue'] as Tab[])
                : (['info', 'lyrics', 'queue'] as Tab[])
              ).map((t) => (
                <button
                  key={t}
                  className={cn(
                    'flex-1 py-3.5 text-[11px] font-bold uppercase tracking-wider transition-colors',
                    activeTab === t
                      ? 'border-b-2 border-white text-white'
                      : 'text-white/35 hover:text-white/70',
                  )}
                  onClick={() => setActiveTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="custom-scrollbar flex-1 overflow-y-auto">
              {/* Info tab */}
              {activeTab === 'info' && (
                <div className="space-y-5 p-5">
                  {/* Visualiser */}
                  <div className="flex items-center justify-center rounded-xl bg-white/5 py-6">
                    <AudioVisualizer mode="spectrum" className="h-16 w-full px-4" />
                  </div>

                  {/* Meta */}
                  <div className="space-y-3">
                    {[
                      ['Track', currentFile.title],
                      ['Artist', currentFile.artist],
                      ['Album', currentFile.album],
                      ['Genre', currentFile.genre],
                      ['Year', currentFile.year],
                      isRadio ? null : ['Duration', formatDuration(duration)],
                      ['BPM', currentFile.bpm ? `${Math.round(currentFile.bpm)}` : null],
                      ['Key', currentFile.camelot_key],
                    ]
                      .filter(
                        (row): row is [string, string | number] => row !== null && Boolean(row[1]),
                      )
                      .map(([k, v]) => (
                        <div key={k as string} className="flex items-start justify-between gap-2">
                          <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/30">
                            {k}
                          </span>
                          <span className="break-all text-right text-xs text-white/70">
                            {v as string}
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Up Next */}
                  {recommendations.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                        Up Next
                      </p>
                      <div className="space-y-1">
                        {recommendations.map((rec) => (
                          <div
                            key={rec.id}
                            className="hover:bg-white/8 group flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-colors"
                            onClick={() => {
                              const f = files.find((f) => f.id === rec.id);
                              if (f) usePlayerStore.getState().playFile(f);
                            }}
                          >
                            <img
                              src={rec.cover || '/placeholder.svg'}
                              alt={rec.title}
                              className="h-11 w-11 flex-shrink-0 rounded-lg object-cover shadow-md transition-transform group-hover:scale-105"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-white">
                                {rec.title}
                              </p>
                              <p className="truncate text-[10px] text-white/40">{rec.artist}</p>
                            </div>
                            <Play
                              size={13}
                              className="flex-shrink-0 text-white/0 transition-colors group-hover:text-white/60"
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Lyrics tab */}
              {activeTab === 'lyrics' && (
                <div ref={lyricsRef} className="space-y-3 p-5 py-8">
                  {lyrics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                      <Mic size={32} className="text-white/20" />
                      <p className="text-sm text-white/30">No lyrics available</p>
                    </div>
                  ) : (
                    lyrics.map((line, i) => (
                      <p
                        key={i}
                        className={cn(
                          'cursor-pointer text-base font-semibold leading-relaxed transition-all duration-300',
                          i === activeLyricIdx
                            ? 'scale-105 text-white'
                            : i < activeLyricIdx
                              ? 'text-white/30'
                              : 'text-white/50 hover:text-white/80',
                        )}
                        onClick={() => usePlayerStore.getState().seekTo(line.time)}
                      >
                        {line.text}
                      </p>
                    ))
                  )}
                </div>
              )}

              {/* Queue tab */}
              {activeTab === 'queue' && (
                <div className="space-y-0.5 p-3">
                  {queue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                      <ListMusic size={32} className="text-white/20" />
                      <p className="text-sm text-white/30">Queue is empty</p>
                    </div>
                  ) : (
                    queue.map((track, i) => (
                      <div
                        key={`${track.id}-${i}`}
                        draggable
                        onDragStart={(e) => {
                          setDragIndex(i);
                          // Required for Firefox to actually initiate the drag.
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(i));
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null && dragIndex !== i) setDragOverIndex(i);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null && dragIndex !== i) {
                            queueManager.reorder(dragIndex, i);
                          }
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        className={cn(
                          'group flex items-center gap-2 rounded-xl p-2.5 transition-colors',
                          i === queueIdx ? 'bg-white/12' : 'hover:bg-white/8',
                          dragOverIndex === i && 'ring-1 ring-purple-400/60',
                          dragIndex === i && 'opacity-40',
                        )}
                      >
                        <button
                          type="button"
                          className="flex-shrink-0 cursor-grab touch-none text-white/20 hover:text-white/50 active:cursor-grabbing"
                          aria-label="Drag to reorder"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical size={14} />
                        </button>
                        <div
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                          onClick={() => {
                            queueManager.setCurrentIndex(i);
                            usePlayerStore.getState().playFile(track);
                          }}
                        >
                          <div className="relative h-10 w-10 flex-shrink-0">
                            <img
                              src={track.cover || '/placeholder.svg'}
                              alt={track.title}
                              className="h-full w-full rounded-lg object-cover"
                            />
                            {i === queueIdx && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                                {isPlaying ? (
                                  <Pause size={13} fill="currentColor" className="text-white" />
                                ) : (
                                  <Play
                                    size={13}
                                    fill="currentColor"
                                    className="ml-0.5 text-white"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                'truncate text-xs font-semibold',
                                i === queueIdx ? 'text-purple-300' : 'text-white',
                              )}
                            >
                              {track.title}
                            </p>
                            <p className="truncate text-[10px] text-white/40">{track.artist}</p>
                          </div>
                          <span className="font-mono text-[10px] text-white/25">
                            {formatDuration(track.duration ?? 0)}
                          </span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="flex-shrink-0 rounded-full p-1 text-white/20 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                              aria-label="Remove from queue"
                              onClick={(e) => {
                                e.stopPropagation();
                                queueManager.remove(i);
                              }}
                            >
                              <X size={14} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Remove from queue</TooltipContent>
                        </Tooltip>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
// This file is complete — no append needed
