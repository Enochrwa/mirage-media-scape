import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { API_BASE, formatDuration } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

const DuplicateManagerPage = () => {
    const [groups, setGroups] = useState<any[][]>([]);
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
                setGroups(prev => {
                    const next = [...prev];
                    next[groupIndex] = next[groupIndex].filter(t => t.id !== id);
                    return next.filter(g => g.length > 1);
                });
            }
        } catch (e) {
            console.error('Failed to delete track', e);
        }
    };

    return (
        <MainLayout>
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight mb-2 text-white">Duplicate Finder</h1>
                        <p className="text-zinc-400 text-lg">Clean up your library by removing identical tracks.</p>
                    </div>
                    {groups.length > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2 flex items-center gap-2 text-yellow-500 text-sm font-medium">
                            <AlertCircle size={16} />
                            {groups.length} potential duplicate groups found
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="grid gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-48 bg-white/5 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
                        <div className="p-4 bg-green-500/10 rounded-full text-green-500">
                            <CheckCircle2 size={48} />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Your library is clean!</h2>
                        <p className="text-zinc-500">No duplicates were found using the current scan criteria.</p>
                    </div>
                ) : (
                    <div className="grid gap-8">
                        {groups.map((group, groupIdx) => (
                            <Card key={groupIdx} className="bg-zinc-900/50 border-white/5 overflow-hidden">
                                <div className="p-4 border-b border-white/5 bg-white/5">
                                    <h3 className="font-bold text-zinc-300">Group {groupIdx + 1}: {group[0].artist} — {group[0].title}</h3>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {group.map((track) => (
                                        <div key={track.id} className="p-4 flex items-center gap-6 hover:bg-white/5 transition-colors">
                                            <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                                                <img src={track.cover_cache_path || '/placeholder.svg'} className="w-full h-full object-cover" alt="" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{track.file_path}</p>
                                                <div className="flex gap-4 mt-1 text-xs text-zinc-500">
                                                    <span>{(track.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                                    <span>{Math.round(track.bitrate / 1000)} kbps</span>
                                                    <span>{track.format}</span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-zinc-500 hover:text-red-500 hover:bg-red-500/10"
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
