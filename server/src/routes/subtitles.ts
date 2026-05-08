import { Router } from 'express';
import { extract_subtitle_stream, get_subtitle_tracks } from '../../sonic-native.node';
import { SubtitleCue } from '../../../src/lib/utils';

const router = Router();

router.get('/tracks', (req, res) => {
    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') return res.status(400).send('Path required');
    try {
        const tracks = get_subtitle_tracks(filePath);
        res.json(tracks);
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

router.get('/extract', (req, res) => {
    const { path: filePath, index } = req.query;
    if (!filePath || typeof filePath !== 'string' || !index) return res.status(400).send('Params required');
    try {
        const content = extract_subtitle_stream(filePath, parseInt(index as string));
        res.send(content);
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

router.post('/parse', (req, res) => {
    const { content, format } = req.body;
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
    return blocks.map(block => {
        const lines = block.split(/\r?\n/);
        if (lines.length < 3) return null;
        const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2}[,.]\d{3}) --> (\d{2}:\d{2}:\d{2}[,.]\d{3})/);
        if (!timeMatch) return null;
        return {
            start: timeToSeconds(timeMatch[1]),
            end: timeToSeconds(timeMatch[2]),
            text: lines.slice(2).join('\n').replace(/<[^>]*>/g, '')
        };
    }).filter((c): c is SubtitleCue => c !== null);
}

function parseVTT(content: string): SubtitleCue[] {
    const lines = content.trim().split(/\r?\n/);
    if (!lines[0].startsWith('WEBVTT')) return [];
    return parseSRT(content.replace('WEBVTT', ''));
}

function parseASS(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const eventsSection = content.split('[Events]')[1];
    if (!eventsSection) return [];
    const lines = eventsSection.split(/\r?\n/);
    for (const line of lines) {
        if (line.startsWith('Dialogue:')) {
            const parts = line.split(',');
            const start = timeToSeconds(parts[1]);
            const end = timeToSeconds(parts[2]);
            const text = parts.slice(9).join(',').replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n');
            cues.push({ start, end, text });
        }
    }
    return cues;
}

function timeToSeconds(timeStr: string): number {
    const parts = timeStr.replace(',', '.').split(':').map(parseFloat);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0];
}

export default router;
