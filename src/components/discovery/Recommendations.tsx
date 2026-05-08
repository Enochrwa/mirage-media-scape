import React, { useState, useEffect } from 'react';
import { useMedia, MediaFile } from '@/contexts/MediaContext';
import { API_BASE } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecommendationsProps {
    trackId: string;
}

const Recommendations: React.FC<RecommendationsProps> = ({ trackId }) => {
    const { playFile } = useMedia();
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
            <h3 className="text-sm font-semibold flex items-center gap-2 text-zinc-400">
                <Sparkles className="w-4 h-4 text-purple-400" />
                More Like This
            </h3>
            <div className="grid gap-2">
                {recommended.map(track => (
                    <Card
                        key={track.id}
                        className="p-2 bg-white/5 border-transparent hover:bg-white/10 cursor-pointer group flex items-center gap-3"
                        onClick={() => playFile(track)}
                    >
                        <div className="w-10 h-10 rounded overflow-hidden relative">
                            <img src={track.cover || '/placeholder.svg'} alt={track.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="w-4 h-4 text-white fill-current" />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{track.title}</p>
                            <p className="text-[10px] text-zinc-500 truncate">{track.artist}</p>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default Recommendations;
