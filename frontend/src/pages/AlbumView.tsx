import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import MainLayout from '@/components/MainLayout';
import { API_BASE, formatDuration } from '@/lib/utils';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Button } from '@/components/ui/button';
import { Play, Shuffle, Plus, Music, Clock, Disc } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MediaFile } from '@/types/media';

export const AlbumView = () => {
  const { id } = useParams();
  const [data, setData] = useState<{
    album: { name: string; artist: string; year: number; cover?: string };
    tracks: MediaFile[];
  } | null>(null);
  const { playFile, currentFile, isPlaying } = usePlayerStore();

  useEffect(() => {
    fetch(`${API_BASE}/api/tracks/album/${id}`)
      .then((res) => res.json())
      .then(setData);
  }, [id]);

  if (!data) return null;

  const totalDuration = data.tracks.reduce((acc: number, t) => acc + (t.duration || 0), 0);
  const bestQuality = data.tracks.reduce(
    (prev, curr) => (Number(curr.bitrate) > Number(prev.bitrate) ? curr : prev),
    data.tracks[0],
  );

  return (
    <MainLayout>
      <div className="flex flex-col md:flex-row gap-8 items-end mb-12 animate-in fade-in duration-500">
         <img src={data.album.cover ? `${API_BASE}/api/tracks/cover/${data.tracks[0].id}` : '/placeholder.svg'} className="w-64 h-64 rounded-xl shadow-2xl" alt="" />
         <div className="space-y-4 flex-1">
            <Badge variant="outline" className="text-purple-400 border-purple-500/30 uppercase tracking-widest text-[10px]">Album</Badge>
            <h1 className="text-6xl font-black">{data.album.name}</h1>
            <div className="flex items-center gap-2 text-zinc-400 font-medium">
               <Link to={`/artist/${data.album.artist}`} className="hover:text-white transition-colors">{data.album.artist}</Link>
               <span>•</span>
               <span>{data.album.year}</span>
               <span>•</span>
               <span>{data.tracks.length} tracks, {formatDuration(totalDuration)}</span>
            </div>
            <div className="flex items-center gap-3">
               <Badge variant="secondary" className="bg-white/10 text-white font-mono text-[10px]">
                  {(bestQuality as unknown as { codec_name?: string }).codec_name?.toUpperCase()} {Math.round(Number(bestQuality.bitrate || 0) / 1000)}kbps
               </Badge>
            </div>
            <div className="flex gap-4 pt-2">
               <Button onClick={() => playFile(data.tracks[0])} className="bg-purple-600 hover:bg-purple-700 h-12 px-8 rounded-full gap-2">
                  <Play size={20} fill="currentColor" /> Play Album
               </Button>
               <Button variant="outline" className="rounded-full border-white/10 h-12 w-12 p-0">
                  <Shuffle size={20} />
               </Button>
               <Button variant="outline" className="rounded-full border-white/10 h-12 w-12 p-0">
                  <Plus size={20} />
               </Button>
            </div>
         </div>
      </div>

      <div className="space-y-1 border-t border-white/5 pt-6">
         <div className="flex items-center gap-4 px-4 py-2 text-zinc-500 text-xs font-bold uppercase tracking-widest">
            <span className="w-8 text-center">#</span>
            <span className="flex-1">Title</span>
            <span className="w-20 text-right"><Clock size={14} className="ml-auto" /></span>
         </div>
         {data.tracks.map((track, i: number) => {
            const isActive = currentFile?.id === track.id;
            return (
               <div
                 key={track.id}
                 onClick={() => playFile(track)}
                 className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-white/5 group cursor-pointer transition-colors"
               >
                  <span className="w-8 text-center text-zinc-500 group-hover:text-white">
                     {isActive && isPlaying ? <div className="flex gap-0.5 items-end h-3 justify-center"><div className="w-0.5 bg-primary animate-bounce h-full"/><div className="w-0.5 bg-primary animate-bounce h-2/3"/><div className="w-0.5 bg-primary animate-bounce h-3/4"/></div> : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                     <p className={cn("font-medium truncate", isActive ? "text-primary" : "text-white")}>{track.title}</p>
                     <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
                  </div>
                  <span className="w-20 text-right text-xs text-zinc-500 font-mono">{formatDuration(track.duration || 0)}</span>
               </div>
            );
         })}
      </div>
    </MainLayout>
  );
};
