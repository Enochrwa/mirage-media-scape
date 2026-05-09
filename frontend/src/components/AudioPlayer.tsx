import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { trimAudio, normalizeVolume, changeVolume, applyFade } from '@/lib/ffmpeg';
import { cn } from '@/lib/utils';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX, 
  Repeat, Shuffle, Heart, Share2, BookmarkPlus,
  Zap, Activity, Maximize, Minimize, X,
  SlidersHorizontal, Download
} from 'lucide-react';
import { EqualizerControls } from './player/EqualizerControls';
import { LyricsDisplay } from './player/LyricsDisplay';
import Recommendations from './discovery/Recommendations';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { MediaFile } from '@/types/media';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';

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
  const [sleepTimer, setSleepTimer] = useState(0);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimRegion, setTrimRegion] = useState<{ start: number, end: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [volumeBoost, setVolumeBoost] = useState(0);
  const [fadeInDuration, setFadeInDuration] = useState(0);
  const [fadeOutDuration, setFadeOutDuration] = useState(0);
  const [bassBoost, setBassBoost] = useState(0);
  const [trebleBoost, setTrebleBoost] = useState(0);
  
  // Refs
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);

  const toggleTrimming = () => {
    setIsTrimming(!isTrimming);
    if (!isTrimming && regionsRef.current) {
        regionsRef.current.addRegion({
            start: 0,
            end: duration / 4,
            color: 'rgba(255, 0, 0, 0.1)'
        });
    } else if (regionsRef.current) {
        regionsRef.current.clearRegions();
    }
  };

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
    ws.setMuted(true);
    
    const wsRegions = ws.registerPlugin(RegionsPlugin.create());
    regionsRef.current = wsRegions;

    wsRegions.on('region-updated', (region: Region) => {
        const regions = wsRegions.getRegions();
        if (regions.length > 1) {
            const firstRegion = regions[0];
            if (firstRegion.id !== region.id) {
                firstRegion.remove();
            }
        }
        setTrimRegion({ start: region.start, end: region.end });
    });

    ws.on('ready', () => {
      setDuration(ws.getDuration());
    });

    ws.on('interaction', (newProgress: number) => {
        const engine = usePlayerStore.getState().playbackEngine;
        if (engine) {
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
    const engine = usePlayerStore.getState().playbackEngine;
    if (engine) engine.startSleepTimer(minutes * 60);
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
    } catch (e) { console.error('Trim failed'); }
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
    } catch (e) { console.error('Normalization failed'); }
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
            <Slider value={[currentTime]} max={duration} onValueChange={(v) => setCurrentTime(v[0])} className="flex-1" />
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

          <div className="relative h-48 bg-black/20 rounded-2xl overflow-hidden border border-white/10">
            {showLyrics ? <LyricsDisplay artist={currentFile.artist || ''} title={currentFile.title} currentTime={currentTime} className="h-full" /> : <div ref={waveformRef} className="h-full w-full" />}
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 text-white">
              <span className="font-mono text-gray-400 w-16">{formatTime(currentTime)}</span>
              <Slider value={[currentTime]} max={duration} onValueChange={(v) => setCurrentTime(v[0])} className="flex-1" />
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleVolumeClick} className="text-gray-400"><VolumeIcon /></Button>
                <Slider value={[volume]} max={1} step={0.01} onValueChange={(v) => handleVolumeChange(v)} className="w-24" />
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
                        <Slider value={[bassBoost]} min={-12} max={12} onValueChange={(v) => setBassBoost(v[0])} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-gray-300 text-sm">Treble Boost</label>
                        <Slider value={[trebleBoost]} min={-12} max={12} onValueChange={(v) => setTrebleBoost(v[0])} />
                    </div>
                </div>
                <div className="pt-4 border-t border-white/10 flex flex-wrap gap-4">
                    <Button variant="outline" onClick={toggleTrimming}>{isTrimming ? 'Cancel' : 'Trim'}</Button>
                    {isTrimming && trimRegion && <Button onClick={handleConfirmTrim}>Confirm Trim</Button>}
                    <Button variant="outline" onClick={handleNormalize}>Normalize</Button>
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
