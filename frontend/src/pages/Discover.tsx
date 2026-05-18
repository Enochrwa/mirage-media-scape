import React, { useEffect, useState } from 'react';
import { ZovyraLayout as MainLayout } from '@/components/ZovyraLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Heart, UserPlus } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '@/lib/utils';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Link } from 'react-router-dom';
import { MediaFile } from '@/types/media';

export default function Discover() {
  const [recent, setRecent] = useState([]);
  const [trending, setTrending] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const playFile = usePlayerStore((state) => state.playFile);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [r, t, s] = await Promise.all([
          axios.get(`${API_BASE}/api/social/discover/recent`),
          axios.get(`${API_BASE}/api/social/discover/trending`),
          axios
            .get(`${API_BASE}/api/social/discover/suggested-users`)
            .catch(() => ({ data: { users: [] } })),
        ]);
        setRecent(r.data.tracks);
        setTrending(t.data.tracks);
        setSuggested(s.data.users);
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-12 p-8 pb-32">
      <section>
        <h2 className="mb-6 text-3xl font-bold">Recently Uploaded</h2>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-5">
          {recent.map((track: any) => (
            <Card
              key={track.id}
              className="group relative overflow-hidden border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-700"
            >
              <div className="relative aspect-square">
                <img
                  src={
                    track.cover_cache_path
                      ? `${API_BASE}/api/covers/${track.cover_cache_path.split('/').pop()}?size=300`
                      : '/placeholder.svg'
                  }
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="icon"
                    className="rounded-full bg-indigo-600 hover:bg-indigo-500"
                    onClick={() => playFile(track)}
                  >
                    <Play fill="currentColor" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="truncate font-bold">{track.title}</h3>
                <p className="truncate text-sm text-zinc-400">{track.artist}</p>
                <Link
                  to={`/profile/${track.owner_id}`}
                  className="mt-1 block text-xs text-indigo-400 hover:underline"
                >
                  @{track.owner_name}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-3xl font-bold">Trending This Week</h2>
        <div className="space-y-4">
          {trending.map((track: any, i) => (
            <div
              key={track.id}
              className="flex items-center gap-4 rounded-lg bg-zinc-900/50 p-3 transition-colors hover:bg-zinc-900"
            >
              <span className="w-8 text-2xl font-black text-zinc-800">{i + 1}</span>
              <img
                src={
                  track.cover_cache_path
                    ? `${API_BASE}/api/covers/${track.cover_cache_path.split('/').pop()}?size=64`
                    : '/placeholder.svg'
                }
                className="h-12 w-12 rounded object-cover"
              />
              <div className="flex-1">
                <h4 className="font-bold">{track.title}</h4>
                <p className="text-xs text-zinc-400">
                  {track.artist} • @{track.owner_name}
                </p>
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <Heart size={14} className="text-red-500" fill="currentColor" />
                <span className="text-sm font-medium">{track.likes}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => playFile(track)}>
                <Play size={16} fill="currentColor" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {suggested.length > 0 && (
        <section>
          <h2 className="mb-6 text-3xl font-bold">People to Follow</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {suggested.map(
              (user: {
                id: string;
                username: string;
                avatar_path: string;
                track_count: number;
              }) => (
                <div
                  key={user.id}
                  className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                >
                  <img
                    src={
                      user.avatar_path
                        ? `${API_BASE}/api/covers/${user.avatar_path.split('/').pop()}?size=64`
                        : '/placeholder.svg'
                    }
                    className="h-16 w-16 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <h4 className="text-lg font-bold">@{user.username}</h4>
                    <p className="text-xs text-zinc-400">{user.track_count} public tracks</p>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="rounded-full border-zinc-700 hover:bg-indigo-600/20 hover:text-indigo-400"
                  >
                    <UserPlus size={18} />
                  </Button>
                </div>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
