import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { MediaFile } from '@/types/media';
import { API_BASE } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecommendationsProps {
  trackId: string;
}

const Recommendations: React.FC<RecommendationsProps> = ({ trackId }) => {
  const { playFile } = usePlayerStore();
  const [recommended, setRecommended] = useState<MediaFile[]>([]);

  useEffect(() => {
    const fetchRecommended = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tracks/${trackId}/recommendations?limit=5`);
        if (res.ok) {
          const data = await res.json();
          setRecommended(data);
        }
      } catch (e) {
        console.error('Failed to fetch recommendations', e);
      }
    };
    fetchRecommended();
  }, [trackId]);

  if (recommended.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-400">
        <Sparkles className="h-4 w-4 text-purple-400" />
        More Like This
      </h3>
      <div className="grid gap-2">
        {recommended.map((track) => (
          <Card
            key={track.id}
            className="group flex cursor-pointer items-center gap-3 border-transparent bg-white/5 p-2 hover:bg-white/10"
            onClick={() => {
             const file: MediaFile = track;
             playFile(file);
           }}
          >
            <div className="relative h-10 w-10 overflow-hidden rounded">
              <img
                src={track.cover || '/placeholder.svg'}
                alt={track.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Play className="h-4 w-4 fill-current text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{track.title}</p>
              <p className="truncate text-[10px] text-zinc-500">{track.artist}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Recommendations;
