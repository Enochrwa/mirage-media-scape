import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { API_BASE } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Radio, Search, Play, Globe } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';

interface RadioStation {
  stationuuid: string;
  name: string;
  country: string;
  url_resolved: string;
  favicon?: string;
  tags?: string;
}

const RadioPage = () => {
  const { playFile } = usePlayerStore();
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const searchStations = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://de1.api.radio-browser.info/json/stations/byname/${encodeURIComponent(query)}?limit=20`,
      );
      if (res.ok) setStations(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const playStation = (station: RadioStation) => {
    playFile({
      id: station.stationuuid,
      title: station.name,
      artist: station.country,
      file: station.url_resolved,
      type: 'audio',
      cover: station.favicon || '',
    });
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-white">Internet Radio</h1>
          <p className="text-zinc-400">Listen to over 40,000 stations from around the globe.</p>
        </div>

        <div className="flex max-w-md gap-2">
          <Input
            placeholder="Search by station name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchStations()}
            className="border-white/10 bg-zinc-900"
          />
          <Button onClick={searchStations} disabled={loading} className="bg-purple-600">
            <Search size={18} />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stations.map((station) => (
            <Card
              key={station.stationuuid}
              className="group border-white/5 bg-zinc-900/50 p-4 transition-colors hover:border-purple-500/50"
            >
              <div className="flex items-center gap-4">
                <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5">
                  {station.favicon ? (
                    <img src={station.favicon} className="h-full w-full object-contain" alt="" />
                  ) : (
                    <Radio className="text-zinc-700" size={24} />
                  )}
                  <div
                    className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => playStation(station)}
                  >
                    <Play size={20} className="fill-current text-white" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-white">{station.name}</h3>
                  <p className="flex items-center gap-1 truncate text-xs text-zinc-500">
                    <Globe size={10} /> {station.country}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1">
                {station.tags &&
                  station.tags
                    .split(',')
                    .slice(0, 3)
                    .map((tag: string) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400"
                      >
                        {tag.trim()}
                      </span>
                    ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
};

export default RadioPage;
