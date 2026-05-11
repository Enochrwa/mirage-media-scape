import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { API_BASE, formatDuration } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Music, Clock, User, BarChart3, History } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { MediaFile } from '@/types/media';

interface StatsSummary {
  totalPlays: number;
  totalTimeSeconds: number;
  topArtist: string;
}

interface TopTrack {
  id: string;
  cover_cache_path?: string;
  title: string;
  artist: string;
  play_count: number;
}

type HistoryEntry = Record<string, unknown>;

const StatsPage = () => {
  const { playFile } = usePlayerStore();
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [topRes, historyRes, summaryRes] = await Promise.all([
          fetch(`${API_BASE}/api/stats/top-tracks`),
          fetch(`${API_BASE}/api/stats/history`),
          fetch(`${API_BASE}/api/stats/summary`),
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
      <div className="space-y-8 duration-500 animate-in fade-in">
        <div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight">Listening Stats</h1>
          <p className="text-muted-foreground">Your musical journey in numbers.</p>
        </div>

        {summary && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card className="border-white/10 bg-gradient-to-br from-purple-600/20 to-blue-600/20 p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-purple-500/20 p-3 text-purple-400">
                  <BarChart3 size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                    Total Plays
                  </p>
                  <p className="text-3xl font-bold">{summary.totalPlays}</p>
                </div>
              </div>
            </Card>
            <Card className="border-white/10 bg-gradient-to-br from-cyan-600/20 to-emerald-600/20 p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-cyan-500/20 p-3 text-cyan-400">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                    Listening Time
                  </p>
                  <p className="text-3xl font-bold">
                    {(summary.totalTimeSeconds / 3600).toFixed(1)} hrs
                  </p>
                </div>
              </div>
            </Card>
            <Card className="border-white/10 bg-gradient-to-br from-orange-600/20 to-pink-600/20 p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-orange-500/20 p-3 text-orange-400">
                  <User size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                    Top Artist
                  </p>
                  <p className="max-w-[150px] truncate text-2xl font-bold">{summary.topArtist}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <BarChart3 className="text-purple-400" />
              Most Played Tracks
            </h2>
            <div className="space-y-2">
              {topTracks.map((track, i) => (
                <div
                  key={track.id}
                  className="group flex cursor-pointer items-center gap-4 rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10"
                  onClick={() => playFile(track as unknown as MediaFile)}
                >
                  <span className="w-6 text-xl font-bold text-zinc-600">{i + 1}</span>
                  <img
                    src={track.cover_cache_path || '/placeholder.svg'}
                    className="h-12 w-12 rounded object-cover"
                    alt=""
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium group-hover:text-purple-400">
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{track.artist}</p>
                  </div>
                  <span className="rounded-full bg-purple-400/10 px-2 py-1 text-xs font-bold text-purple-400">
                    {track.play_count} plays
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <History className="text-cyan-400" />
              Recently Played
            </h2>
            <div className="space-y-2">
              {history.map((track) => (
                <div
                  key={`${track.id}-${track.started_at}`}
                  className="flex cursor-pointer items-center gap-4 rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10"
                  onClick={() => playFile(track as unknown as MediaFile)}
                >
                  <img
                    src={track.cover_cache_path || '/placeholder.svg'}
                    className="h-10 w-10 rounded object-cover opacity-60"
                    alt=""
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{track.title}</p>
                    <p className="truncate text-[10px] text-zinc-500">{track.artist}</p>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(track.started_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
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
