import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { API_BASE, formatDuration } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle2, AlertCircle, Play, ShieldCheck, Sparkles } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn } from '@/lib/utils';

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
  const [selections, setSelections] = useState<Record<string, 'keep' | 'trash'>>({});
  const { playbackEngine } = usePlayerStore();

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

  const keepBest = () => {
    const newSels: Record<string, 'keep' | 'trash'> = {};
    groups.forEach((group) => {
      const best = [...group].sort((a, b) => b.bitrate - a.bitrate)[0];
      group.forEach((t) => {
        newSels[t.id] = t.id === best.id ? 'keep' : 'trash';
      });
    });
    setSelections(newSels);
  };

  const applyAll = async () => {
    const toTrash = Object.entries(selections)
      .filter(([_, v]) => v === 'trash')
      .map(([id]) => id);
    if (!confirm(`Move ${toTrash.length} files to trash?`)) return;

    // In real app, call bulk trash endpoint
    alert('Bulk action executed');
  };

  const previewAudio = (id: string) => {
     playbackEngine.preview(30); // 30s in
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
            <div className="flex gap-2">
               <Button variant="outline" className="gap-2 border-purple-500/30 text-purple-400" onClick={keepBest}>
                  <Sparkles size={16} /> Keep Best in All Groups
               </Button>
               <Button className="gap-2 bg-purple-600" onClick={applyAll}>
                  Apply All Selections
               </Button>
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
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-zinc-500 hover:text-white"
                          onClick={() => previewAudio(track.id)}
                        >
                          <Play size={18} />
                        </Button>

                        <div className="flex bg-black/40 rounded-lg p-1">
                           <button
                             onClick={() => setSelections({...selections, [track.id]: 'keep'})}
                             className={cn("px-3 py-1 rounded text-[10px] font-bold transition-all", selections[track.id] === 'keep' ? "bg-green-500 text-white" : "text-zinc-500")}
                           >
                              KEEP
                           </button>
                           <button
                             onClick={() => setSelections({...selections, [track.id]: 'trash'})}
                             className={cn("px-3 py-1 rounded text-[10px] font-bold transition-all", selections[track.id] === 'trash' ? "bg-red-500 text-white" : "text-zinc-500")}
                           >
                              TRASH
                           </button>
                        </div>
                      </div>
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
