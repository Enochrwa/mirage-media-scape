import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { API_BASE, formatDuration } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface DuplicateTrack {
  id: string;
  artist?: string;
  title?: string;
  cover_cache_path?: string;
  file_path: string;
  file_size: number;
  bitrate: number;
  format: string;
}

const DuplicateManagerPage = () => {
  const [groups, setGroups] = useState<DuplicateTrack[][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDuplicates = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tracks/duplicates/candidates`);
        if (res.ok) {
          setGroups(await res.json());
        }
      } catch (e) {
        console.error('Failed to fetch duplicates', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDuplicates();
  }, []);

  const deleteTrack = async (id: string, groupIndex: number) => {
    if (!confirm('Are you sure you want to move this file to trash?')) return;

    try {
      const res = await fetch(`${API_BASE}/api/tracks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setGroups((prev) => {
          const next = [...prev];
          next[groupIndex] = next[groupIndex].filter((t) => t.id !== id);
          return next.filter((g) => g.length > 1);
        });
      }
    } catch (e) {
      console.error('Failed to delete track', e);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8 duration-500 animate-in slide-in-from-bottom-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight text-white">Duplicate Finder</h1>
            <p className="text-lg text-zinc-400">
              Clean up your library by removing identical tracks.
            </p>
          </div>
          {groups.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-500">
              <AlertCircle size={16} />
              {groups.length} potential duplicate groups found
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-32 text-center">
            <div className="rounded-full bg-green-500/10 p-4 text-green-500">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-2xl font-bold text-white">Your library is clean!</h2>
            <p className="text-zinc-500">
              No duplicates were found using the current scan criteria.
            </p>
          </div>
        ) : (
          <div className="grid gap-8">
            {groups.map((group, groupIdx) => (
              <Card key={groupIdx} className="overflow-hidden border-white/5 bg-zinc-900/50">
                <div className="border-b border-white/5 bg-white/5 p-4">
                  <h3 className="font-bold text-zinc-300">
                    Group {groupIdx + 1}: {group[0].artist} — {group[0].title}
                  </h3>
                </div>
                <div className="divide-y divide-white/5">
                  {group.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-6 p-4 transition-colors hover:bg-white/5"
                    >
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded">
                        <img
                          src={track.cover_cache_path || '/placeholder.svg'}
                          className="h-full w-full object-cover"
                          alt=""
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{track.file_path}</p>
                        <div className="mt-1 flex gap-4 text-xs text-zinc-500">
                          <span>{(track.file_size / 1024 / 1024).toFixed(2)} MB</span>
                          <span>{Math.round(track.bitrate / 1000)} kbps</span>
                          <span>{track.format}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-zinc-500 hover:bg-red-500/10 hover:text-red-500"
                        onClick={() => deleteTrack(track.id, groupIdx)}
                      >
                        <Trash2 size={20} />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default DuplicateManagerPage;
