import React, { useState, useEffect, useMemo } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { API_BASE, SubtitleCue } from '@/lib/utils';

interface SubtitleTrack {
  index: number;
  language?: string;
  label?: string;
  title?: string;
  codec?: string;
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Captions, Upload } from 'lucide-react';

const SubtitleManager: React.FC = () => {
  const { currentFile, currentTime } = usePlayerStore();
  const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);

  const [settings, setSettings] = useState({
    fontSize: 24,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    offset: 0,
  });

  useEffect(() => {
    if (!currentFile || currentFile.type !== 'video') return;

    const fetchTracks = async () => {
      const res = await fetch(
        `${API_BASE}/api/subtitles/tracks?path=${encodeURIComponent(currentFile.file_path || '')}`,
      );
      if (res.ok) {
        const data = await res.json();
        setTracks(data);
      }
    };
    fetchTracks();
  }, [currentFile]);

  const selectTrack = async (index: number) => {
    if (!currentFile) return;
    const res = await fetch(
      `${API_BASE}/api/subtitles/extract?path=${encodeURIComponent(currentFile.file_path || '')}&index=${index}`,
    );
    if (res.ok) {
      const { raw } = await res.json();
      const format = currentFile.file_path?.endsWith('.ass') ? 'ass' : 'srt';
      const parseRes = await fetch(`${API_BASE}/api/subtitles/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw, format }),
      });
      if (parseRes.ok) {
        const { cues } = await parseRes.json();
        setCues(cues);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const raw = event.target?.result as string;
      const format = file.name.split('.').pop()?.toLowerCase() || 'srt';
      const res = await fetch(`${API_BASE}/api/subtitles/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw, format }),
      });
      if (res.ok) {
        const { cues } = await res.json();
        setCues(cues);
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const cue = cues.find((c) => currentTime >= c.start && currentTime <= c.end);
    setActiveCue(cue || null);
  }, [currentTime, cues]);

  if (!currentFile || currentFile.type !== 'video') return null;

  return (
    <>
      {activeCue && (
        <div
          className="pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 text-center"
          style={{ bottom: `${8 + settings.offset}%` }}
        >
          <span
            className="rounded border border-white/10 px-3 py-1 shadow-lg whitespace-pre-wrap"
            style={{
              fontSize: `${settings.fontSize}px`,
              color: settings.color,
              backgroundColor: settings.backgroundColor,
            }}
          >
            {activeCue.text}
          </span>
        </div>
      )}

      <div className="absolute right-16 top-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <Captions className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-zinc-800 bg-zinc-900 text-white w-64">
            <DropdownMenuItem onClick={() => setCues([])}>None</DropdownMenuItem>
            <div className="border-t border-zinc-800 my-1" />
            <div className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase">Embedded Tracks</div>
            {tracks.map((track) => (
              <DropdownMenuItem key={track.index} onClick={() => selectTrack(track.index)}>
                {track.title || track.language || `Track ${track.index}`} ({track.codec})
              </DropdownMenuItem>
            ))}
            <div className="border-t border-zinc-800 my-1" />
            <div className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase">External</div>
            <DropdownMenuItem className="cursor-pointer" asChild>
              <label className="flex items-center gap-2 w-full">
                <Upload className="h-4 w-4" />
                <span>Load Subtitle File...</span>
                <input type="file" accept=".srt,.vtt,.ass,.ssa,.sbv" className="hidden" onChange={handleFileUpload} />
              </label>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default SubtitleManager;
