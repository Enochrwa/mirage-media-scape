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
      <div className="mb-12 flex flex-col items-end gap-8 duration-500 animate-in fade-in md:flex-row">
        <img
          src={
            data.album.cover
              ? `${API_BASE}/api/tracks/cover/${data.tracks[0].id}`
              : '/placeholder.svg'
          }
          className="h-64 w-64 rounded-xl shadow-2xl"
          alt=""
        />
        <div className="flex-1 space-y-4">
          <Badge
            variant="outline"
            className="border-purple-500/30 text-[10px] uppercase tracking-widest text-purple-400"
          >
            Album
          </Badge>
          <h1 className="text-6xl font-black">{data.album.name}</h1>
          <div className="flex items-center gap-2 font-medium text-zinc-400">
            <Link
              to={`/artist/${data.album.artist}`}
              className="transition-colors hover:text-white"
            >
              {data.album.artist}
            </Link>
            <span>•</span>
            <span>{data.album.year}</span>
            <span>•</span>
            <span>
              {data.tracks.length} tracks, {formatDuration(totalDuration)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-white/10 font-mono text-[10px] text-white">
              {(bestQuality as unknown as { codec_name?: string }).codec_name?.toUpperCase()}{' '}
              {Math.round(Number(bestQuality.bitrate || 0) / 1000)}kbps
            </Badge>
          </div>
          <div className="flex gap-4 pt-2">
            <Button
              onClick={() => playFile(data.tracks[0])}
              className="h-12 gap-2 rounded-full bg-purple-600 px-8 hover:bg-purple-700"
            >
              <Play size={20} fill="currentColor" /> Play Album
            </Button>
            <Button variant="outline" className="h-12 w-12 rounded-full border-white/10 p-0">
              <Shuffle size={20} />
            </Button>
            <Button variant="outline" className="h-12 w-12 rounded-full border-white/10 p-0">
              <Plus size={20} />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-1 border-t border-white/5 pt-6">
        <div className="flex items-center gap-4 px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="w-8 text-center">#</span>
          <span className="flex-1">Title</span>
          <span className="w-20 text-right">
            <Clock size={14} className="ml-auto" />
          </span>
        </div>
        {data.tracks.map((track, i: number) => {
          const isActive = currentFile?.id === track.id;
          return (
            <div
              key={track.id}
              onClick={() => playFile(track)}
              className="group flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-white/5"
            >
              <span className="w-8 text-center text-zinc-500 group-hover:text-white">
                {isActive && isPlaying ? (
                  <div className="flex h-3 items-end justify-center gap-0.5">
                    <div className="h-full w-0.5 animate-bounce bg-primary" />
                    <div className="h-2/3 w-0.5 animate-bounce bg-primary" />
                    <div className="h-3/4 w-0.5 animate-bounce bg-primary" />
                  </div>
                ) : (
                  i + 1
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate font-medium', isActive ? 'text-primary' : 'text-white')}>
                  {track.title}
                </p>
                <p className="truncate text-xs text-zinc-500">{track.artist}</p>
              </div>
              <span className="w-20 text-right font-mono text-xs text-zinc-500">
                {formatDuration(track.duration || 0)}
              </span>
            </div>
          );
        })}
      </div>
    </MainLayout>
  );
};
