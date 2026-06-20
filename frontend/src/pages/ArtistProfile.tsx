import { Play, Shuffle, MoreHorizontal, CheckCircle2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrackTable } from '@/components/tracks/TrackTable';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export function ArtistProfile() {
  const { name } = useParams();
  const [artistData, setArtistData] = useState<Record<string, string | number | undefined> | null>(
    null,
  );
  const [history, setHistory] = useState<{ month: string; minutes: number }[]>([]);

  useEffect(() => {
    if (!name) return;
    fetch(`${API_BASE}/api/stats/artist/${encodeURIComponent(name)}/history`)
      .then((res) => res.json())
      .then(setHistory);
  }, [name]);

  return (
    <div className="flex-1 overflow-y-auto bg-black no-scrollbar">
      {/* Hero Section */}
      <div className="relative flex h-[40vh] min-h-[300px] flex-col justify-end overflow-hidden p-8">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1514525253361-9134b223d6a2?w=1600&q=80")',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>

        <div className="relative z-10">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 fill-current text-blue-500" />
            <span className="text-sm font-medium">Verified Artist</span>
          </div>
          <h1 className="mb-6 text-8xl font-black">{name || 'Dua Lipa'}</h1>
          <p className="mb-2 text-gray-300">
            Verified Artist • {history.reduce((a, b) => a + b.minutes, 0)} mins listened
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-6 p-8">
        <Button size="lg" className="h-14 w-14 rounded-full bg-purple-600 p-0 hover:bg-purple-700">
          <Play className="ml-1 h-6 w-6 fill-current" />
        </Button>
        <Button
          variant="outline"
          className="rounded-full border-white/20 px-8 py-6 text-xs font-bold uppercase tracking-widest hover:bg-white/10"
        >
          Following
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-400">
          <MoreHorizontal className="h-8 w-8" />
        </Button>
      </div>

      {/* Popular Tracks */}
      <section className="mb-12">
        <h2 className="mb-4 px-8 text-2xl font-bold">Popular</h2>
        <TrackTable />
      </section>

      {/* Listening History Arc */}
      <section className="mb-12 px-8">
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
          <History className="text-purple-400" /> Listening History
        </h2>
        <div className="flex h-32 items-end gap-1 rounded-2xl border border-white/10 bg-white/5 p-6 px-4">
          {history.map((m, i) => (
            <div key={i} className="group relative flex-1">
              <div
                className="w-full rounded-t-sm bg-purple-500 transition-all hover:bg-purple-400"
                style={{ height: `${(m.minutes / 500) * 100}%`, minHeight: '4px' }}
              />
              <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100">
                {m.month}: {m.minutes} mins
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Artist Pick */}
      <section className="mb-12 px-8">
        <h2 className="mb-4 text-2xl font-bold">Artist Pick</h2>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-md bg-zinc-800">
            <img src="https://picsum.photos/seed/dua/80/80" alt="Album Art" />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-zinc-700">
                <img src="https://picsum.photos/seed/dua/24/24" alt="" />
              </div>
              <span className="text-xs text-gray-400">Post by Dua Lipa</span>
            </div>
            <h4 className="font-bold">Dua Lipa Best Of</h4>
            <p className="text-sm text-gray-400">Playlist</p>
          </div>
        </div>
      </section>
    </div>
  );
}
