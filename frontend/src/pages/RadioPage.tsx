import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { API_BASE, cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Radio, Search, Play, Globe, Zap, Moon, Heart, Smile } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'internet' | 'mood' | 'artist' | 'similar'>('internet');
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const moods = [
    { id: 'focus', icon: <Zap size={24} />, label: 'Focus' },
    { id: 'workout', icon: <Heart size={24} />, label: 'Workout' },
    { id: 'sleep', icon: <Moon size={24} />, label: 'Sleep' },
    { id: 'party', icon: <Smile size={24} />, label: 'Party' },
  ];

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
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-white">Radio</h1>
          <p className="text-zinc-400">Discover new music based on internet stations, moods, or artists.</p>
        </div>

        <div className="flex gap-4 border-b border-white/10">
          {(['internet', 'mood', 'artist', 'similar'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'pb-2 text-sm font-medium transition-colors',
                activeTab === tab ? 'border-b-2 border-purple-500 text-white' : 'text-zinc-500 hover:text-white'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'internet' && (
          <div className="space-y-6 animate-in fade-in duration-300">
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
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'mood' && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 animate-in fade-in duration-300">
            {moods.map((mood) => (
              <Card
                key={mood.id}
                className="flex flex-col items-center justify-center gap-4 border-white/5 bg-zinc-900/50 p-8 transition-colors hover:border-purple-500/50 cursor-pointer group"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20 text-purple-500 group-hover:scale-110 transition-transform">
                  {mood.icon}
                </div>
                <span className="font-bold text-white">{mood.label}</span>
              </Card>
            ))}
          </div>
        )}

        {(activeTab === 'artist' || activeTab === 'similar') && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 animate-in fade-in duration-300">
            <Radio size={48} className="mb-4 opacity-20" />
            <p>Start a radio from your favorite {activeTab === 'artist' ? 'artist' : 'track'}.</p>
            <p className="text-sm">Search and select {activeTab === 'artist' ? 'an artist' : 'a track'} to begin.</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default RadioPage;
