import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { API_BASE, formatDuration } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Music, Clock, User, BarChart3, History } from 'lucide-react';
import { useMedia } from '@/contexts/MediaContext';

const StatsPage = () => {
    const { playFile } = useMedia();
    const [topTracks, setTopTracks] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [topRes, historyRes, summaryRes] = await Promise.all([
                    fetch(`${API_BASE}/api/stats/top-tracks`),
                    fetch(`${API_BASE}/api/stats/history`),
                    fetch(`${API_BASE}/api/stats/summary`)
                ]);

                if (topRes.ok) setTopTracks(await topRes.json());
                if (historyRes.ok) setHistory(await historyRes.json());
                if (summaryRes.ok) setSummary(await summaryRes.json());
            } catch (e) {
                console.error('Failed to fetch stats', e);
            }
        };
        fetchStats();
    }, []);

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in duration-500">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">Listening Stats</h1>
                    <p className="text-muted-foreground">Your musical journey in numbers.</p>
                </div>

                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="p-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-white/10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400">
                                    <BarChart3 size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400 uppercase font-bold tracking-wider">Total Plays</p>
                                    <p className="text-3xl font-bold">{summary.totalPlays}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-6 bg-gradient-to-br from-cyan-600/20 to-emerald-600/20 border-white/10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-cyan-500/20 rounded-lg text-cyan-400">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400 uppercase font-bold tracking-wider">Listening Time</p>
                                    <p className="text-3xl font-bold">{(summary.totalTimeSeconds / 3600).toFixed(1)} hrs</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-6 bg-gradient-to-br from-orange-600/20 to-pink-600/20 border-white/10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-orange-500/20 rounded-lg text-orange-400">
                                    <User size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400 uppercase font-bold tracking-wider">Top Artist</p>
                                    <p className="text-2xl font-bold truncate max-w-[150px]">{summary.topArtist}</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <BarChart3 className="text-purple-400" />
                            Most Played Tracks
                        </h2>
                        <div className="space-y-2">
                            {topTracks.map((track, i) => (
                                <div
                                    key={track.id}
                                    className="flex items-center gap-4 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer group"
                                    onClick={() => playFile(track)}
                                >
                                    <span className="text-xl font-bold text-zinc-600 w-6">{i + 1}</span>
                                    <img src={track.cover_cache_path || '/placeholder.svg'} className="w-12 h-12 rounded object-cover" alt="" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate group-hover:text-purple-400">{track.title}</p>
                                        <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
                                    </div>
                                    <span className="text-xs font-bold text-purple-400 bg-purple-400/10 px-2 py-1 rounded-full">
                                        {track.play_count} plays
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <History className="text-cyan-400" />
                            Recently Played
                        </h2>
                        <div className="space-y-2">
                            {history.map((track) => (
                                <div
                                    key={`${track.id}-${track.started_at}`}
                                    className="flex items-center gap-4 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                    onClick={() => playFile(track)}
                                >
                                    <img src={track.cover_cache_path || '/placeholder.svg'} className="w-10 h-10 rounded object-cover opacity-60" alt="" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{track.title}</p>
                                        <p className="text-[10px] text-zinc-500 truncate">{track.artist}</p>
                                    </div>
                                    <span className="text-[10px] text-zinc-500">
                                        {new Date(track.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default StatsPage;
