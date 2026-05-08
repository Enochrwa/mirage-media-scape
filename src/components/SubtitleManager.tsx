import React, { useState, useEffect, useMemo } from 'react';
import { useMedia } from '@/contexts/MediaContext';
import { API_BASE, SubtitleCue } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Captions } from 'lucide-react';

const SubtitleManager: React.FC = () => {
    const { currentFile, currentTime } = useMedia();
    const [tracks, setTracks] = useState<any[]>([]);
    const [cues, setCues] = useState<SubtitleCue[]>([]);
    const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);

    useEffect(() => {
        if (!currentFile || currentFile.type !== 'video') return;

        const fetchTracks = async () => {
            const res = await fetch(`${API_BASE}/api/subtitles/tracks?path=${encodeURIComponent(currentFile.file_path || '')}`);
            if (res.ok) {
                const data = await res.json();
                setTracks(data);
            }
        };
        fetchTracks();
    }, [currentFile]);

    const selectTrack = async (index: number) => {
        if (!currentFile) return;
        const res = await fetch(`${API_BASE}/api/subtitles/extract?path=${encodeURIComponent(currentFile.file_path || '')}&index=${index}`);
        if (res.ok) {
            const content = await res.text();
            const parseRes = await fetch(`${API_BASE}/api/subtitles/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, format: 'srt' }) // Assuming SRT for now
            });
            if (parseRes.ok) {
                const parsedCues = await parseRes.json();
                setCues(parsedCues);
            }
        }
    };

    useEffect(() => {
        const cue = cues.find(c => currentTime >= c.start && currentTime <= c.end);
        setActiveCue(cue || null);
    }, [currentTime, cues]);

    if (!currentFile || currentFile.type !== 'video') return null;

    return (
        <>
            {activeCue && (
                <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 pointer-events-none z-50 text-center">
                    <span className="bg-black/60 text-white px-3 py-1 rounded text-xl shadow-lg border border-white/10">
                        {activeCue.text}
                    </span>
                </div>
            )}

            <div className="absolute top-4 right-16">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                            <Captions className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-white">
                        <DropdownMenuItem onClick={() => setCues([])}>None</DropdownMenuItem>
                        {tracks.map(track => (
                            <DropdownMenuItem key={track.index} onClick={() => selectTrack(track.index)}>
                                {track.title || track.language || `Track ${track.index}`} ({track.codec})
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </>
    );
};

export default SubtitleManager;
