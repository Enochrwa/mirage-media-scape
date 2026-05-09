import React, { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { trimAudio, normalizeVolume, changeVolume, applyFade } from '@/lib/ffmpeg';
import { cn } from '@/lib/utils';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX, 
  Repeat, Shuffle, Heart, Share2, BookmarkPlus,
  Mic, Radio, Headphones, Settings, Zap, Music,
  Timer, Rewind, FastForward, Download, Star,
  TrendingUp, Activity, Eye, EyeOff, Maximize, Minimize, X,
  Palette, SlidersHorizontal
} from 'lucide-react';
import { EqualizerControls } from './player/EqualizerControls';
import { LyricsDisplay } from './player/LyricsDisplay';
import Recommendations from './discovery/Recommendations';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { MediaFile, Playlist } from '@/types/media';

// Re-using the simplified UI components for consistency
const Button = ({ children, variant = "default", size = "default", className = "", onClick, ...props }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
      variant === "ghost" ? "hover:bg-accent hover:text-accent-foreground" :
      variant === "outline" ? "border border-input hover:bg-accent hover:text-accent-foreground" :
      "bg-primary text-primary-foreground hover:bg-primary/90",
      size === "sm" ? "h-9 px-3 rounded-md text-xs" :
      size === "icon" ? "h-10 w-10" :
      "h-10 px-4 py-2",
      className
    )}
    {...props}
  >
    {children}
  </button>
);

const Card = ({ children, className = "" }: any) => (
  <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default", className = "" }: any) => (
  <div className={cn(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    variant === "secondary" ? "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80" :
    variant === "outline" ? "text-foreground" :
    "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    className
  )}>
    {children}
  </div>
);

const Slider = ({ value, max, min = 0, step = 1, onValueChange, className = "" }: any) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onValueChange([newValue]);
  };

  return (
    <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={handleChange}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, rgb(139, 92, 246) 0%, rgb(139, 92, 246) ${(value[0] / max) * 100}%, rgb(55, 65, 81) ${(value[0] / max) * 100}%, rgb(55, 65, 81) 100%)`
        }}
      />
    </div>
  );
};

const Switch = ({ checked, onCheckedChange, className = "" }: any) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-purple-600" : "bg-gray-600",
      className
    )}
  >
    <span
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
        checked ? "translate-x-5" : "translate-x-0"
      )}
    />
  </button>
);

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

interface AudioPlayerProps {
  file?: MediaFile;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ file }) => {
  const {
    currentFile: storeFile,
    isPlaying,
    togglePlayback,
    volume,
    setVolume,
    currentTime,
    duration,
    setCurrentTime,
    setDuration,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    nextTrack,
    previousTrack,
    closePlayer,
    isPlayerFullscreen,
    setPlayerFullscreen
  } = usePlayerStore();

  const { files, playlists, addToPlaylist } = useLibraryStore();

  const currentFile = file || storeFile;

  // Local UI states
  const [muted, setMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  const [isFavorite, setIsFavorite] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [sleepTimer, setSleepTimer] = useState(0);
  const [crossfadeEnabled, setCrossfadeEnabled] = useState(false);
  const [bassBoost, setBassBoost] = useState(0);
  const [trebleBoost, setTrebleBoost] = useState(0);
  const [surroundSound, setSurroundSound] = useState(false);
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [autoGain, setAutoGain] = useState(true);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [ambientMode, setAmbientMode] = useState(false);
  const [particleEffect, setParticleEffect] = useState(true);
  const [moodLighting, setMoodLighting] = useState('auto');
  const [rating, setRating] = useState(0);
  const [recordingMode, setRecordingMode] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showMoodMenu, setShowMoodMenu] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimRegion, setTrimRegion] = useState<{ start: number, end: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [volumeBoost, setVolumeBoost] = useState(0);
  const [fadeInDuration, setFadeInDuration] = useState(0);
  const [fadeOutDuration, setFadeOutDuration] = useState(0);
  
  // Refs
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<any>(null);

  useEffect(() => {
    if (!waveformRef.current || !currentFile) return;
    
    if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
    }

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgb(167, 139, 250)',
      progressColor: 'rgb(79, 70, 229)',
      url: currentFile.file,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      height: 120,
      cursorWidth: 2,
      cursorColor: '#fff',
      interact: true,
    });

    wavesurferRef.current = ws;
    ws.setMuted(true); // Single source of truth is PlaybackEngine
    
    const wsRegions = ws.registerPlugin(RegionsPlugin.create());
    regionsRef.current = wsRegions;

    wsRegions.on('region-updated', (region) => {
        const regions = wsRegions.getRegions();
        if (Object.keys(regions).length > 1) {
            const firstRegionKey = Object.keys(regions)[0];
            if (regions[firstRegionKey].id !== region.id) {
                regions[firstRegionKey].remove();
            }
        }
        setTrimRegion({ start: region.start, end: region.end });
    });

    ws.on('ready', () => {
      setDuration(ws.getDuration());
    });

    ws.on('interaction', (newProgress) => {
        const engine = (window as any).playbackEngine;
        if (engine) {
            // Seek on interaction
            const seekTime = newProgress * ws.getDuration();
            setCurrentTime(seekTime);
        }
    });

    return () => {
      ws.destroy();
    };
  }, [currentFile?.file]);

  useEffect(() => {
    if (wavesurferRef.current && duration > 0) {
        wavesurferRef.current.setTime(currentTime);
    }
  }, [currentTime, duration]);

  const handleVolumeClick = () => {
    if (muted) {
        setMuted(false);
        setVolume(prevVolume);
    } else {
        setPrevVolume(volume);
        setMuted(true);
        setVolume(0);
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0];
    setVolume(vol);
    if (vol > 0 && muted) setMuted(false);
    else if (vol === 0) setMuted(true);
  };

  const VolumeIcon = () => {
    if (muted || volume === 0) return <VolumeX size={20} />;
    if (volume < 0.5) return <Volume1 size={20} />;
    return <Volume2 size={20} />;
  };

  const handleSleepTimer = (minutes: number) => {
    setSleepTimer(minutes);
    setShowTimerMenu(false);
    const engine = (window as any).playbackEngine;
    if (engine) engine.startSleepTimer(minutes * 60);
  };

  const showToast = (message: string) => {
    console.log('Toast:', message);
  };

  const handleConfirmTrim = async () => {
    if (!trimRegion || !currentFile) return;
    setIsProcessing(true);
    try {
        const blob = await trimAudio(currentFile.file, trimRegion.start, trimRegion.end);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trimmed_${currentFile.title}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Trim successful!');
    } catch (e) { showToast('Trim failed'); }
    finally { setIsProcessing(false); }
  };

  const handleNormalize = async () => {
    if (!currentFile) return;
    setIsProcessing(true);
    try {
        const blob = await normalizeVolume(currentFile.file);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `normalized_${currentFile.title}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Normalization complete!');
    } catch (e) { showToast('Normalization failed'); }
    finally { setIsProcessing(false); }
  };

  const handleVolumeBoost = async () => {
      if (!currentFile || volumeBoost === 0) return;
      setIsProcessing(true);
      try {
          const blob = await changeVolume(currentFile.file, volumeBoost);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `boosted_${currentFile.title}.wav`;
          a.click();
          URL.revokeObjectURL(url);
          showToast('Volume boost applied!');
      } catch (e) { showToast('Boost failed'); }
      finally { setIsProcessing(false); }
  };

  const handleApplyFades = async () => {
    if (!currentFile) return;
    setIsProcessing(true);
    try {
        const blob = await applyFade(currentFile.file, duration, fadeInDuration, fadeOutDuration);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `faded_${currentFile.title}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Fades applied!');
    } catch (e) { showToast('Fades failed'); }
    finally { setIsProcessing(false); }
  };

  if (!currentFile) return null;

  if (isPlayerFullscreen) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center justify-between p-8 text-white">
        <div className="absolute top-4 right-4 flex gap-2">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => {
                const link = document.createElement('a');
                link.href = currentFile.file;
                link.download = `${currentFile.title}.mp3`;
                link.click();
            }}><Download size={22} /></Button>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => setPlayerFullscreen(false)}><Minimize size={22} /></Button>
        </div>
        <div className="flex flex-col items-center gap-6 text-center">
          <img src={currentFile.cover || '/placeholder.svg'} alt={currentFile.title} className="w-64 h-64 rounded-full shadow-2xl animate-pulse-slow" />
          <h1 className="text-5xl font-bold">{currentFile.title}</h1>
          <p className="text-2xl text-gray-400">{currentFile.artist}</p>
        </div>
        <div className="w-full max-w-3xl space-y-6">
          <div className="flex items-center gap-4">
            <span className="font-mono text-gray-400 w-16">{formatTime(currentTime)}</span>
            <Slider value={[currentTime]} max={duration} onValueChange={(v: number[]) => setCurrentTime(v[0])} className="flex-1" />
            <span className="font-mono text-gray-400 w-16">{formatTime(duration)}</span>
          </div>
          <div className="flex items-center justify-center gap-6">
            <Button variant="ghost" size="icon" onClick={() => previousTrack(files)}><SkipBack size={28} /></Button>
            <Button size="icon" className="w-24 h-24 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full" onClick={togglePlayback}>
                {isPlaying ? <Pause size={36} /> : <Play size={36} className="ml-1" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => nextTrack(files)}><SkipForward size={28} /></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto h-[95vh] bg-gradient-to-br from-slate-900 via-purple-900/20 to-cyan-900/20 p-4 flex items-center justify-center">
      <Card className="relative overflow-hidden w-full h-full bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-2xl">
        <div className="relative z-10 p-8 space-y-8 overflow-y-auto h-full">
          {/* Header */}
          <div className="flex items-start gap-8">
            <img src={currentFile.cover || '/placeholder.svg'} alt={currentFile.title} className="w-32 h-32 rounded-2xl object-cover shadow-2xl" />
            <div className="flex-1 min-w-0 space-y-4">
              <h2 className="text-4xl font-bold text-white truncate">{currentFile.title}</h2>
              <p className="text-2xl text-gray-300 truncate">{currentFile.artist}</p>
              <div className="flex items-center gap-4">
                <Badge variant="secondary">{currentFile.genre || 'Music'}</Badge>
                {currentFile.bpm && <span className="text-gray-400 flex items-center gap-1"><Activity size={16}/>{Math.round(currentFile.bpm)} BPM</span>}
                {currentFile.camelot_key && <span className="text-cyan-400 flex items-center gap-1"><Zap size={16}/>{currentFile.camelot_key}</span>}
              </div>
            </div>
            <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => setIsFavorite(!isFavorite)} className={isFavorite ? "text-red-400" : "text-gray-400"}><Heart size={24} fill={isFavorite ? "currentColor" : "none"} /></Button>
                <div className="relative">
                    <Button variant="ghost" size="icon" className="text-gray-400" onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}><BookmarkPlus size={24} /></Button>
                    {showPlaylistMenu && (
                        <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg p-2 min-w-48 z-50">
                            {playlists.map(p => (
                                <button key={p.id} className="block w-full text-left text-gray-300 hover:bg-slate-700 p-2 rounded text-sm" onClick={() => { addToPlaylist(p.id, currentFile.id); setShowPlaylistMenu(false); }}>{p.name}</button>
                            ))}
                        </div>
                    )}
                </div>
                <Button variant="ghost" size="icon" onClick={closePlayer} className="text-gray-400"><X size={24} /></Button>
            </div>
          </div>

          {/* Waveform / Lyrics */}
          <div className="relative h-48 bg-black/20 rounded-2xl overflow-hidden border border-white/10">
            {showLyrics ? <LyricsDisplay artist={currentFile.artist || ''} title={currentFile.title} currentTime={currentTime} className="h-full" /> : <div ref={waveformRef} className="h-full w-full" />}
          </div>

          {/* Controls */}
          <div className="space-y-6">
            <div className="flex items-center gap-4 text-white">
              <span className="font-mono text-gray-400 w-16">{formatTime(currentTime)}</span>
              <Slider value={[currentTime]} max={duration} onValueChange={(v: number[]) => setCurrentTime(v[0])} className="flex-1" />
              <span className="font-mono text-gray-400 w-16">{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setShuffle(!shuffle)} className={shuffle ? "text-purple-400" : "text-gray-400"}><Shuffle size={22}/></Button>
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="text-white" onClick={() => previousTrack(files)}><SkipBack size={24}/></Button>
                <Button size="icon" className="w-16 h-16 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full" onClick={togglePlayback}>
                    {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                </Button>
                <Button variant="ghost" size="icon" className="text-white" onClick={() => nextTrack(files)}><SkipForward size={24}/></Button>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setRepeat(!repeat)} className={repeat ? "text-purple-400" : "text-gray-400"}><Repeat size={22}/></Button>
            </div>
          </div>

          {/* Advanced Panels */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleVolumeClick} className="text-gray-400"><VolumeIcon /></Button>
                <Slider value={[volume]} max={1} step={0.01} onValueChange={handleVolumeChange} className="w-24" />
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setShowEqualizer(!showEqualizer)} className={showEqualizer ? "text-purple-400" : "text-gray-400"}><Activity size={20}/></Button>
                <Button variant="ghost" onClick={() => setShowAdvancedControls(!showAdvancedControls)} className={showAdvancedControls ? "text-purple-400" : "text-gray-400"}><SlidersHorizontal size={20}/></Button>
                <Button variant="ghost" onClick={() => setPlayerFullscreen(true)} className="text-gray-400"><Maximize size={20}/></Button>
            </div>
          </div>

          {showEqualizer && <div className="mt-4 p-4 bg-black/40 rounded-xl"><EqualizerControls onClose={() => setShowEqualizer(false)} /></div>}

          {showAdvancedControls && (
            <div className="mt-4 p-6 bg-black/40 rounded-xl space-y-6">
                <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-gray-300 text-sm">Bass Boost</label>
                        <Slider value={[bassBoost]} min={-12} max={12} onValueChange={(v: number[]) => setBassBoost(v[0])} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-gray-300 text-sm">Treble Boost</label>
                        <Slider value={[trebleBoost]} min={-12} max={12} onValueChange={(v: number[]) => setTrebleBoost(v[0])} />
                    </div>
                </div>
                <div className="pt-4 border-t border-white/10 flex flex-wrap gap-4">
                    <Button variant="outline" onClick={toggleTrimming}>{isTrimming ? 'Cancel' : 'Trim'}</Button>
                    {isTrimming && trimRegion && <Button onClick={handleConfirmTrim}>Confirm Trim</Button>}
                    <Button variant="outline" onClick={handleNormalize}>Normalize</Button>
                    <div className="flex items-center gap-2">
                        <label className="text-gray-300 text-sm">Boost dB</label>
                        <input type="number" value={volumeBoost} onChange={(e) => setVolumeBoost(parseInt(e.target.value))} className="w-16 bg-gray-800 p-1 rounded" />
                        <Button variant="outline" onClick={handleVolumeBoost}>Apply</Button>
                    </div>
                </div>
                <div className="pt-4 border-t border-white/10 flex gap-4">
                    <div className="space-y-1">
                        <label className="text-xs text-gray-400">Fade In (s)</label>
                        <input type="number" value={fadeInDuration} onChange={(e) => setFadeInDuration(parseFloat(e.target.value))} className="w-16 bg-gray-800 p-1 rounded" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-gray-400">Fade Out (s)</label>
                        <input type="number" value={fadeOutDuration} onChange={(e) => setFadeOutDuration(parseFloat(e.target.value))} className="w-16 bg-gray-800 p-1 rounded" />
                    </div>
                    <Button variant="outline" onClick={handleApplyFades} className="self-end">Apply Fades</Button>
                </div>
            </div>
          )}

          <Recommendations trackId={currentFile.id} />
        </div>
      </Card>
    </div>
  );
};

export default AudioPlayer;
