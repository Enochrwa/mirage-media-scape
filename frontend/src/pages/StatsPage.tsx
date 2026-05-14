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
  file?: string;
}

interface HistoryEntry {
  id: string;
  title: string;
  artist?: string | null;
  cover_cache_path?: string | null;
  started_at: string;
  file?: string;
}

interface HeatmapEntry {
  day: string;
  hour: string;
  count: number;
}

const Heatmap: React.FC<{ data: HeatmapEntry[] }> = ({ data }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px] space-y-2">
        <div className="flex">
          <div className="w-10" />
          {hours.map((h) => (
            <div key={h} className="flex-1 text-center text-[8px] text-zinc-500">
              {h}
            </div>
          ))}
        </div>
        {days.map((day, di) => (
          <div key={day} className="flex items-center gap-1">
            <div className="w-10 text-[10px] font-bold text-zinc-400">{day}</div>
            {hours.map((hour) => {
              const entry = data.find((d) => parseInt(d.day) === di && parseInt(d.hour) === hour);
              const count = entry?.count || 0;
              const intensity = count / maxCount;
              return (
                <div
                  key={hour}
                  className="h-4 flex-1 rounded-sm bg-purple-500"
                  style={{ opacity: intensity > 0 ? 0.2 + intensity * 0.8 : 0.05 }}
                  title={`${day} ${hour}:00 - ${count} plays`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const StatsPage = () => {
  const { playFile } = usePlayerStore();
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [topRes, historyRes, summaryRes, heatmapRes] = await Promise.all([
          fetch(`${API_BASE}/api/stats/top-tracks`),
          fetch(`${API_BASE}/api/stats/history`),
          fetch(`${API_BASE}/api/stats/summary`),
          fetch(`${API_BASE}/api/stats/heatmap`),
        ]);

        if (topRes.ok) {
          const json = await topRes.json();
          setTopTracks((json.data || json) as TopTrack[]);
        }
        if (historyRes.ok) {
          const json = await historyRes.json();
          setHistory((json.data || json) as HistoryEntry[]);
        }
        if (summaryRes.ok) {
          const json = await summaryRes.json();
          setSummary((json.data || json) as StatsSummary);
        }
        if (heatmapRes.ok) {
          const json = await heatmapRes.json();
          setHeatmap((json.data || json) as HeatmapEntry[]);
        }
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
                  <p className="max-w-[150px] truncate text-2xl font-bold">
                    {summary.topArtist ?? ''}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {heatmap.length > 0 && (
          <Card className="border-white/10 bg-zinc-900/50 p-6">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-bold">
              <History className="text-purple-400" />
              Listening Activity
            </h2>
            <Heatmap data={heatmap} />
          </Card>
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
                  onClick={() => {
                    const mf: MediaFile = {
                      id: track.id,
                      title: track.title,
                      artist: track.artist ?? undefined,
                      file: track.file ?? `${API_BASE}/api/tracks/stream?path=${track.id}`,
                      type: 'audio',
                      cover: track.cover_cache_path
                        ? `${API_BASE}/api/tracks/cover/${track.id}`
                        : undefined,
                    };
                    playFile(mf);
                  }}
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
                  onClick={() => {
                    const mf: MediaFile = {
                      id: track.id,
                      title: track.title,
                      artist: track.artist ?? undefined,
                      file: track.file ?? `${API_BASE}/api/tracks/stream?path=${track.id}`,
                      type: 'audio',
                      cover: track.cover_cache_path
                        ? `${API_BASE}/api/tracks/cover/${track.id}`
                        : undefined,
                    };
                    playFile(mf);
                  }}
                >
                  <img
                    src={track.cover_cache_path ?? '/placeholder.svg'}
                    className="h-10 w-10 rounded object-cover opacity-60"
                    alt=""
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{track.title}</p>
                    <p className="truncate text-[10px] text-zinc-500">{track.artist ?? ''}</p>
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