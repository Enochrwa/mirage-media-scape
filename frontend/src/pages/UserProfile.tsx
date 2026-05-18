import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Play, UserPlus, UserMinus } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';

export default function UserProfile() {
    const { userId } = useParams();
    const [profile, setProfile] = useState<any>(null);
    const playFile = usePlayerStore(state => state.playFile);

    useEffect(() => {
        axios.get(`${API_BASE}/api/social/users/${userId}/profile`).then(res => setProfile(res.data));
    }, [userId]);

    if (!profile) return null;

    return (
        <div className="p-8 pb-32">
            <header className="flex items-end gap-8 mb-12">
                <img src={profile.user.avatar_path ? `${API_BASE}/api/covers/${profile.user.avatar_path.split('/').pop()}?size=300` : '/placeholder.svg'} className="w-48 h-48 rounded-full object-cover shadow-2xl ring-4 ring-zinc-900" />
                <div className="flex-1">
                    <h1 className="text-6xl font-black mb-4">@{profile.user.username}</h1>
                    <p className="text-zinc-400 max-w-2xl mb-6">{profile.user.bio || 'No bio provided.'}</p>
                    <div className="flex gap-8 text-sm">
                        <div><span className="font-bold text-white text-lg">{profile.trackCount}</span> <span className="text-zinc-500 uppercase tracking-widest text-xs">Tracks</span></div>
                        <div><span className="font-bold text-white text-lg">{profile.followerCount}</span> <span className="text-zinc-500 uppercase tracking-widest text-xs">Followers</span></div>
                        <div><span className="font-bold text-white text-lg">{profile.followingCount}</span> <span className="text-zinc-500 uppercase tracking-widest text-xs">Following</span></div>
                    </div>
                </div>
                <Button className="rounded-full px-8 bg-indigo-600 hover:bg-indigo-500 font-bold">
                    Follow
                </Button>
            </header>

            <section>
                <h2 className="text-2xl font-bold mb-6 border-b border-zinc-800 pb-2">Public Tracks</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {profile.recentTracks.map((track: any) => (
                        <div key={track.id} className="group cursor-pointer" onClick={() => playFile(track)}>
                            <div className="aspect-square relative rounded-lg overflow-hidden mb-3">
                                <img src={track.cover_cache_path ? `${API_BASE}/api/covers/${track.cover_cache_path.split('/').pop()}?size=300` : '/placeholder.svg'} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Play fill="white" className="text-white" />
                                </div>
                            </div>
                            <h4 className="font-bold text-sm truncate">{track.title}</h4>
                            <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
