import { createRequire } from 'node:module';
import { Router } from 'express';
import { SubtitleTrackInfo } from '../../zovyra-native';

const requireNative = createRequire(__filename);
const native = requireNative('../../zovyra-native.node') as {
  get_subtitle_tracks: (path: string) => SubtitleTrackInfo[];
  extract_subtitle_stream: (path: string, index: number) => string;
};

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

const router = Router();

router.get('/tracks', (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath || typeof filePath !== 'string') return res.status(400).send('Path required');
  try {
    const tracks = native.get_subtitle_tracks(filePath) as SubtitleTrackInfo[];
    res.json(tracks);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/extract', (req, res) => {
  const { path: filePath, index } = req.query;
  if (!filePath || typeof filePath !== 'string' || !index)
    return res.status(400).send('Params required');
  try {
    const content = native.extract_subtitle_stream(filePath, parseInt(index as string)) as string;
    res.send(content);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/parse', (req, res) => {
  const { content, format } = req.body as { content: string; format: string };
  if (!content || !format) return res.status(400).send('Content and format required');

  let cues: SubtitleCue[] = [];
  if (format === 'srt') {
    cues = parseSRT(content);
  } else if (format === 'vtt') {
    cues = parseVTT(content);
  } else if (format === 'ass') {
    cues = parseASS(content);
  }

  res.json(cues);
});

function parseSRT(content: string): SubtitleCue[] {
  const blocks = content.trim().split(/\n\r?\n\r?/);
  return blocks
    .map((block) => {
      const lines = block.split(/\r?\n/);
      if (lines.length < 3) return null;
      const timeMatch = lines[1].match(
        /(\d{2}:\d{2}:\d{2}[,.]\d{3}) --> (\d{2}:\d{2}:\d{2}[,.]\d{3})/,
      );
      if (!timeMatch) return null;
      return {
        start: timeToSeconds(timeMatch[1]),
        end: timeToSeconds(timeMatch[2]),
        text: lines
          .slice(2)
          .join('\n')
          .replace(/<[^>]*>/g, ''),
      };
    })
    .filter((c): c is SubtitleCue => c !== null);
}

function parseVTT(content: string): SubtitleCue[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0 || !lines[0].startsWith('WEBVTT')) return [];
  return parseSRT(content.replace('WEBVTT', ''));
}

function parseASS(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const sections = content.split('[Events]');
  if (sections.length < 2) return [];
  const eventsSection = sections[1];
  const lines = eventsSection.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('Dialogue:')) {
      const parts = line.split(',');
      if (parts.length < 10) continue;
      const start = timeToSeconds(parts[1]);
      const end = timeToSeconds(parts[2]);
      const text = parts
        .slice(9)
        .join(',')
        .replace(/\{[^}]*\}/g, '')
        .replace(/\\N/g, '\n');
      cues.push({ start, end, text });
    }
  }
  return cues;
}

function timeToSeconds(timeStr: string): number {
  const parts = timeStr.replace(',', '.').split(':').map(parseFloat);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

export default router;
