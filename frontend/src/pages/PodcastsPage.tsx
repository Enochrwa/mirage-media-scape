import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { API_BASE } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Podcast as PodcastIcon, Plus, Play, Clock, Calendar } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';

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
    } catch (e) { console.error(e); }
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
        body: JSON.stringify({ url })
      });
      if (res.ok) {
        setUrl('');
        fetchSubscriptions();
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const selectPodcast = async (podcast: Podcast) => {
    setSelectedPodcast(podcast);
    try {
      const res = await fetch(`${API_BASE}/api/podcasts/${podcast.id}/episodes`);
      if (res.ok) setEpisodes(await res.json());
    } catch (e) { console.error(e); }
  };

  const playEpisode = (episode: Episode) => {
    playFile({
      id: episode.id,
      title: episode.title,
      artist: selectedPodcast?.title || 'Podcast',
      file: episode.audio_url,
      type: 'audio',
      cover: selectedPodcast?.artwork_url || '',
    });
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white">Podcasts</h1>
            <p className="text-zinc-400">Subscribe to your favorite RSS feeds.</p>
          </div>
          <div className="flex gap-2 max-w-sm">
            <Input
              placeholder="RSS Feed URL..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="bg-zinc-900 border-white/10"
            />
            <Button onClick={subscribe} disabled={loading} className="bg-purple-600">
              <Plus size={18} />
            </Button>
          </div>
        </div>

        {!selectedPodcast ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {subscriptions.map(pod => (
              <div
                key={pod.id}
                className="group cursor-pointer space-y-3"
                onClick={() => selectPodcast(pod)}
              >
                <div className="aspect-square overflow-hidden rounded-xl bg-zinc-800 shadow-lg group-hover:scale-105 transition-transform">
                  <img src={pod.artwork_url} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold truncate text-white">{pod.title}</h3>
                  <p className="text-xs text-zinc-500 truncate">{pod.author}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
             <Button variant="ghost" onClick={() => setSelectedPodcast(null)} className="mb-4">
                ← Back to subscriptions
             </Button>

             <div className="flex gap-8 items-start">
                <img src={selectedPodcast.artwork_url} className="w-48 h-48 rounded-2xl shadow-2xl" alt="" />
                <div className="space-y-4">
                   <h2 className="text-5xl font-black">{selectedPodcast.title}</h2>
                   <p className="text-xl text-zinc-400">{selectedPodcast.author}</p>
                   <p className="text-sm text-zinc-500 max-w-2xl line-clamp-3">{selectedPodcast.description}</p>
                </div>
             </div>

             <div className="space-y-2 mt-12">
                <h3 className="text-2xl font-bold mb-4">Episodes</h3>
                {episodes.map(ep => (
                  <div
                    key={ep.id}
                    className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 group border border-transparent hover:border-white/5 transition-all"
                  >
                    <Button
                      size="icon"
                      onClick={() => playEpisode(ep)}
                      className="bg-white/10 hover:bg-purple-600 text-white rounded-full h-12 w-12"
                    >
                      <Play size={20} fill="currentColor" />
                    </Button>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-lg truncate group-hover:text-purple-400 transition-colors">{ep.title}</h4>
                      <div className="flex items-center gap-4 text-xs text-zinc-500 mt-1">
                        <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(ep.published_at).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {Math.round(ep.duration / 60)} min</span>
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
