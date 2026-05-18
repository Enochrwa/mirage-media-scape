interface UserProfileData {
  user: { username: string; bio: string; avatar_path: string };
  trackCount: number;
  followerCount: number;
  followingCount: number;
  recentTracks: any[];
}
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Play, UserPlus, UserMinus } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';

export default function UserProfile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const playFile = usePlayerStore((state) => state.playFile);

  useEffect(() => {
    axios.get(`${API_BASE}/api/social/users/${userId}/profile`).then((res) => setProfile(res.data));
  }, [userId]);

  if (!profile) return null;

  return (
    <div className="p-8 pb-32">
      <header className="mb-12 flex items-end gap-8">
        <img
          src={
            profile.user.avatar_path
              ? `${API_BASE}/api/covers/${profile.user.avatar_path.split('/').pop()}?size=300`
              : '/placeholder.svg'
          }
          className="h-48 w-48 rounded-full object-cover shadow-2xl ring-4 ring-zinc-900"
        />
        <div className="flex-1">
          <h1 className="mb-4 text-6xl font-black">@{profile.user.username}</h1>
          <p className="mb-6 max-w-2xl text-zinc-400">{profile.user.bio || 'No bio provided.'}</p>
          <div className="flex gap-8 text-sm">
            <div>
              <span className="text-lg font-bold text-white">{profile.trackCount}</span>{' '}
              <span className="text-xs uppercase tracking-widest text-zinc-500">Tracks</span>
            </div>
            <div>
              <span className="text-lg font-bold text-white">{profile.followerCount}</span>{' '}
              <span className="text-xs uppercase tracking-widest text-zinc-500">Followers</span>
            </div>
            <div>
              <span className="text-lg font-bold text-white">{profile.followingCount}</span>{' '}
              <span className="text-xs uppercase tracking-widest text-zinc-500">Following</span>
            </div>
          </div>
        </div>
        <Button className="rounded-full bg-indigo-600 px-8 font-bold hover:bg-indigo-500">
          Follow
        </Button>
      </header>

      <section>
        <h2 className="mb-6 border-b border-zinc-800 pb-2 text-2xl font-bold">Public Tracks</h2>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-6">
          {profile.recentTracks.map((track: any) => (
            <div key={track.id} className="group cursor-pointer" onClick={() => playFile(track)}>
              <div className="relative mb-3 aspect-square overflow-hidden rounded-lg">
                <img
                  src={
                    track.cover_cache_path
                      ? `${API_BASE}/api/covers/${track.cover_cache_path.split('/').pop()}?size=300`
                      : '/placeholder.svg'
                  }
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Play fill="white" className="text-white" />
                </div>
              </div>
              <h4 className="truncate text-sm font-bold">{track.title}</h4>
              <p className="truncate text-xs text-zinc-500">{track.artist}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
