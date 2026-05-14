import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds === Infinity) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Wall-clock style for video badges (always includes hours). */
export function formatVideoClock(seconds: number): string {
  if (isNaN(seconds) || seconds === Infinity) return '0:00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export function parseSRT(content: string): SubtitleCue[] {
  const blocks = content.trim().split(/\n\r?\n\r?/);
  return blocks
    .map((block) => {
      const lines = block.split(/\r?\n/);
      if (lines.length < 3) return null;

      const timeMatch = lines[1].match(
        /(\d{2}:\d{2}:\d{2}[,.]\d{3}) --> (\d{2}:\d{2}:\d{2}[,.]\d{3})/,
      );
      if (!timeMatch) return null;

      const start = timeToSeconds(timeMatch[1]);
      const end = timeToSeconds(timeMatch[2]);
      const text = lines.slice(2).join('\n');

      return { start, end, text };
    })
    .filter((cue): cue is SubtitleCue => cue !== null);
}

function timeToSeconds(timeStr: string): number {
  const [h, m, s] = timeStr.replace(',', '.').split(':').map(parseFloat);
  return h * 3600 + m * 60 + s;
}
