import { createRequire } from 'node:module';

const isESM = typeof import.meta !== 'undefined';
const requireNative = createRequire(isESM ? (import.meta as any).url : __filename);
const native = requireNative('../../zovyra-native.node');

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export class SubtitleService {
  public async getTracks(path: string) {
    return native.get_subtitle_tracks(path);
  }

  public async extractAndParse(path: string, index: number): Promise<SubtitleCue[]> {
    const raw = native.extract_subtitle_stream(path, index);
    if (raw.includes('-->')) {
      return this.parseSRT(raw);
    } else if (raw.includes('WEBVTT')) {
      return this.parseVTT(raw);
    } else if (raw.includes('[Events]')) {
      return this.parseASS(raw);
    }
    return [];
  }

  private parseSRT(data: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const blocks = data.split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 3) continue;

      const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
      if (timeMatch) {
        cues.push({
          start: this.parseTime(timeMatch[1]),
          end: this.parseTime(timeMatch[2]),
          text: lines.slice(2).join('\n')
        });
      }
    }
    return cues;
  }

  private parseVTT(data: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const blocks = data.split(/\n\s*\n/);

    for (const block of blocks) {
      if (block.includes('WEBVTT')) continue;
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 2) continue;

      const timeMatch = lines[0].match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
      if (timeMatch) {
        cues.push({
          start: this.parseTime(timeMatch[1]),
          end: this.parseTime(timeMatch[2]),
          text: lines.slice(1).join('\n')
        });
      }
    }
    return cues;
  }

  private parseASS(data: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const lines = data.split('\n');
    let eventsSection = false;

    for (const line of lines) {
      if (line.includes('[Events]')) {
        eventsSection = true;
        continue;
      }
      if (eventsSection && line.startsWith('Dialogue:')) {
        const parts = line.split(',');
        const start = parts[1];
        const end = parts[2];
        const text = parts.slice(9).join(',').replace(/\{[^}]+\}/g, '').replace(/\\N/g, '\n');

        cues.push({
          start: this.parseTime(start),
          end: this.parseTime(end),
          text: text.trim()
        });
      }
    }
    return cues;
  }

  private parseTime(str: string): number {
    const [hms, frac] = str.replace(',', '.').split('.');
    const parts = hms.split(':').map(Number);
    let h, m, s;
    if (parts.length === 3) {
      [h, m, s] = parts;
    } else {
      [h, m, s] = [0, parts[0], parts[1]];
    }

    let fraction = 0;
    if (frac) {
        fraction = Number(frac.padEnd(3, '0').slice(0, 3)) / 1000;
    }

    return h * 3600 + m * 60 + s + fraction;
  }
}
