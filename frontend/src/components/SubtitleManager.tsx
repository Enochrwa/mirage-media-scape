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
import { Captions, Upload, Search } from 'lucide-react';

const SubtitleManager: React.FC = () => {
  const { currentFile, currentTime } = usePlayerStore();
  const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const [secondaryCues, setSecondaryCues] = useState<SubtitleCue[]>([]);
  const [activeSecondaryCue, setActiveSecondaryCue] = useState<SubtitleCue | null>(null);

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
        const { data } = await res.json();
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
      const { data: content } = await res.json();
      // Detect format from codec if possible, otherwise fallback
      const track = tracks.find(t => t.index === index);
      const format = track?.codec === 'ass' || track?.codec === 'ssa' ? 'ass' : 'srt';

      const parseRes = await fetch(`${API_BASE}/api/subtitles/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, format }),
      });
      if (parseRes.ok) {
        const { data } = await parseRes.json();
        setCues(data);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, secondary = false) => {
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
        const { data } = await res.json();
        if (secondary) setSecondaryCues(data);
        else setCues(data);
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const time = currentTime * 1000;
    const cue = cues.find(
      (c) => time >= c.start + settings.offset && time <= c.end + settings.offset,
    );
    setActiveCue(cue || null);
    const secCue = secondaryCues.find(
      (c) => time >= c.start + settings.offset && time <= c.end + settings.offset,
    );
    setActiveSecondaryCue(secCue || null);
  }, [currentTime, cues, secondaryCues, settings.offset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toUpperCase() === 'Z') {
        setSettings((prev) => ({ ...prev, offset: prev.offset - 100 }));
      } else if (e.shiftKey && e.key.toUpperCase() === 'X') {
        setSettings((prev) => ({ ...prev, offset: prev.offset + 100 }));
      } else if (e.key.toLowerCase() === 'c') {
        if (cues.length > 0) setCues([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cues]);

  if (!currentFile || currentFile.type !== 'video') return null;

  return (
    <>
      {activeSecondaryCue && (
        <div
          className="pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 text-center"
          style={{ bottom: '23%' }}
        >
          <span
            className="whitespace-pre-wrap rounded border border-white/10 px-3 py-1 shadow-lg"
            style={{
              fontSize: `${settings.fontSize * 0.8}px`,
              color: settings.color,
              backgroundColor: settings.backgroundColor,
              opacity: 0.8,
            }}
          >
            {activeSecondaryCue.text}
          </span>
        </div>
      )}

      {activeCue && (
        <div
          className="pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 text-center"
          style={{ bottom: '8%' }}
        >
          <span
            className="whitespace-pre-wrap rounded border border-white/10 px-3 py-1 shadow-lg"
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
          <DropdownMenuContent align="end" className="w-64 border-zinc-800 bg-zinc-900 text-white">
            <DropdownMenuItem onClick={() => setCues([])}>None</DropdownMenuItem>
            <div className="my-1 border-t border-zinc-800" />
            <div className="px-2 py-1.5 text-xs font-semibold uppercase text-zinc-500">
              Embedded Tracks
            </div>
            {tracks.map((track) => (
              <DropdownMenuItem key={track.index} onClick={() => selectTrack(track.index)}>
                {track.title || track.language || `Track ${track.index}`} ({track.codec})
              </DropdownMenuItem>
            ))}
            <div className="my-1 border-t border-zinc-800" />
            <div className="px-2 py-1.5 text-xs font-semibold uppercase text-zinc-500">
              External
            </div>
            <DropdownMenuItem className="cursor-pointer" asChild>
              <label className="flex w-full items-center gap-2">
                <Upload className="h-4 w-4" />
                <span>Primary Subtitle...</span>
                <input
                  type="file"
                  accept=".srt,.vtt,.ass,.ssa,.sbv"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, false)}
                />
              </label>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" asChild>
              <label className="flex w-full items-center gap-2">
                <Upload className="h-4 w-4" />
                <span>Secondary Subtitle...</span>
                <input
                  type="file"
                  accept=".srt,.vtt,.ass,.ssa,.sbv"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, true)}
                />
              </label>
            </DropdownMenuItem>
            <div className="my-1 border-t border-zinc-800" />
            <DropdownMenuItem onClick={async () => {
               if (!currentFile) return;
               const hashRes = await fetch(`${API_BASE}/api/subtitles/hash?path=${encodeURIComponent(currentFile.file_path || '')}`);
               const { data: hash } = await hashRes.json();
               const searchRes = await fetch(`${API_BASE}/api/subtitles/search?hash=${hash}&filename=${encodeURIComponent(currentFile.title || '')}`);
               const { data: results } = await searchRes.json();
               if (results.length > 0) {
                 // In real app, show a dialog to pick. For now, take first.
               }
            }}>
              <Search className="mr-2 h-4 w-4" />
              <span>Search Online</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default SubtitleManager;
