import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import MobileTopBar from '@/components/MobileTopBar';
import { API_BASE } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Podcast as PodcastIcon, Plus, Play, Clock, Calendar } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { MediaFile } from '@/types/media';

interface Podcast {
  id: string;
  title: string;
  author: string;
  artwork_url: string;
  description: string;
}

interface Episode {
  id: string;
  title: string;
  audio_url: string;
  published_at: number;
  duration: number;
  description: string;
}

const PodcastsPage = () => {
  const { playFile } = usePlayerStore();
  const [subscriptions, setSubscriptions] = useState<Podcast[]>([]);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/podcasts/subscriptions`);
      if (res.ok) setSubscriptions(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const subscribe = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/podcasts/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        setUrl('');
        fetchSubscriptions();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectPodcast = async (podcast: Podcast) => {
    setSelectedPodcast(podcast);
    try {
      const res = await fetch(`${API_BASE}/api/podcasts/${podcast.id}/episodes`);
      if (res.ok) setEpisodes(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const playEpisode = (episode: Episode) => {
    const mf: MediaFile = {
      id: episode.id,
      title: episode.title,
      artist: selectedPodcast?.title || 'Podcast',
      file: episode.audio_url,
      type: 'audio',
      cover: selectedPodcast?.artwork_url,
    };
    playFile(mf);
  };

  return (
    <MainLayout>
      <MobileTopBar title="Podcasts" />
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-4xl">Podcasts</h1>
            <p className="text-zinc-400">Subscribe to your favorite RSS feeds.</p>
          </div>
          <div className="flex max-w-sm gap-2">
            <Input
              placeholder="RSS Feed URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="border-white/10 bg-zinc-900"
            />
            <Button onClick={subscribe} disabled={loading} className="bg-purple-600">
              <Plus size={18} />
            </Button>
          </div>
        </div>

        {!selectedPodcast ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-6">
            {subscriptions.map((pod) => (
              <div
                key={pod.id}
                className="group cursor-pointer space-y-3"
                onClick={() => selectPodcast(pod)}
              >
                <div className="aspect-square overflow-hidden rounded-xl bg-zinc-800 shadow-lg transition-transform group-hover:scale-105">
                  <img src={pod.artwork_url} className="h-full w-full object-cover" alt="" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-white">{pod.title}</h3>
                  <p className="truncate text-xs text-zinc-500">{pod.author}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
            <Button variant="ghost" onClick={() => setSelectedPodcast(null)} className="mb-4">
              ← Back to subscriptions
            </Button>

            <div className="flex items-start gap-8">
              <img
                src={selectedPodcast.artwork_url}
                className="h-48 w-48 rounded-2xl shadow-2xl"
                alt=""
              />
              <div className="space-y-4">
                <h2 className="text-5xl font-black">{selectedPodcast.title}</h2>
                <p className="text-xl text-zinc-400">{selectedPodcast.author}</p>
                <p className="line-clamp-3 max-w-2xl text-sm text-zinc-500">
                  {selectedPodcast.description}
                </p>
              </div>
            </div>

            <div className="mt-12 space-y-2">
              <h3 className="mb-4 text-2xl font-bold">Episodes</h3>
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  className="group flex items-center gap-4 rounded-xl border border-transparent p-4 transition-all hover:border-white/5 hover:bg-white/5"
                >
                  <Button
                    size="icon"
                    onClick={() => playEpisode(ep)}
                    className="h-12 w-12 rounded-full bg-white/10 text-white hover:bg-purple-600"
                  >
                    <Play size={20} fill="currentColor" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-lg font-bold transition-colors group-hover:text-purple-400">
                      {ep.title}
                    </h4>
                    <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {new Date(ep.published_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {Math.round(ep.duration / 60)} min
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default PodcastsPage;
