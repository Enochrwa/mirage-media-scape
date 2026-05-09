import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { API_BASE } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Radio, Search, Play, Globe } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';

const RadioPage = () => {
    const { playFile } = usePlayerStore();
    const [stations, setStations] = useState<any[]>([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const searchStations = async () => {
        if (!query) return;
        setLoading(true);
        try {
            const res = await fetch(`https://de1.api.radio-browser.info/json/stations/byname/${encodeURIComponent(query)}?limit=20`);
            if (res.ok) setStations(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const playStation = (station: any) => {
        playFile({
            id: station.stationuuid,
            title: station.name,
            artist: station.country,
            file: station.url_resolved,
            type: 'audio',
            cover: station.favicon || ''
        });
    };

    return (
        <MainLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2 text-white">Internet Radio</h1>
                    <p className="text-zinc-400">Listen to over 40,000 stations from around the globe.</p>
                </div>

                <div className="flex gap-2 max-w-md">
                    <Input
                        placeholder="Search by station name..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && searchStations()}
                        className="bg-zinc-900 border-white/10"
                    />
                    <Button onClick={searchStations} disabled={loading} className="bg-purple-600">
                        <Search size={18} />
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {stations.map(station => (
                        <Card key={station.stationuuid} className="p-4 bg-zinc-900/50 border-white/5 hover:border-purple-500/50 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                                    {station.favicon ? (
                                        <img src={station.favicon} className="w-full h-full object-contain" alt="" />
                                    ) : (
                                        <Radio className="text-zinc-700" size={24} />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => playStation(station)}>
                                        <Play size={20} className="text-white fill-current" />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white truncate">{station.name}</h3>
                                    <p className="text-xs text-zinc-500 truncate flex items-center gap-1">
                                        <Globe size={10} /> {station.country}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-1">
                                {station.tags && station.tags.split(',').slice(0, 3).map((tag: string) => (
                                    <span key={tag} className="text-[10px] bg-white/5 text-zinc-400 px-2 py-0.5 rounded-full">
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
