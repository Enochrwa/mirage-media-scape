import { createRequire } from 'node:module';

const requireNative = createRequire(__filename);
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
    // Basic SRT/VTT parser logic
    if (raw.includes('-->')) {
        return this.parseSRT(raw);
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

  private parseTime(str: string): number {
    const [hms, ms] = str.replace(',', '.').split('.');
    const [h, m, s] = hms.split(':').map(Number);
    return h * 3600 + m * 60 + s + Number(ms) / 1000;
  }
}
