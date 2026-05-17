import fs from 'node:fs';
import path from 'node:path';
import { validatePath } from '../utils/path-utils.js';

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export class SubtitleService {
  static async calculateOpenSubtitlesHash(filePath: string): Promise<string> {
    const absolutePath = path.resolve(filePath);
    if (!validatePath(absolutePath)) throw new Error('Access denied');

    const stats = fs.statSync(absolutePath);
    const fileSize = stats.size;
    const CHUNK_SIZE = 65536; // 64KB

    if (fileSize < CHUNK_SIZE) return '';

    const buffer = Buffer.alloc(CHUNK_SIZE * 2);
    const fd = fs.openSync(absolutePath, 'r');

    try {
        // Read first 64KB
        fs.readSync(fd, buffer, 0, CHUNK_SIZE, 0);
        // Read last 64KB
        fs.readSync(fd, buffer, CHUNK_SIZE, CHUNK_SIZE, Math.max(0, fileSize - CHUNK_SIZE));
    } finally {
        fs.closeSync(fd);
    }

    let hash = BigInt(fileSize);
    for (let i = 0; i < buffer.length; i += 8) {
      hash = (hash + buffer.readBigUInt64LE(i)) & BigInt('0xFFFFFFFFFFFFFFFF');
    }

    return hash.toString(16).padStart(16, '0');
  }

  static parseSRT(content: string): SubtitleCue[] {
    const blocks = content.trim().split(/\n\n+/);
    return blocks
      .map((block) => {
        const lines = block.split('\n');
        if (lines.length < 3) return null;
        const timing = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
        if (!timing) return null;

        return {
          start: this.parseTime(timing[1]),
          end: this.parseTime(timing[2]),
          text: lines
            .slice(2)
            .join('\n')
            .replace(/<[^>]*>/g, ''),
        };
      })
      .filter((c): c is SubtitleCue => c !== null);
  }

  static parseVTT(content: string): SubtitleCue[] {
    const lines = content.trim().split('\n');
    const firstCueIdx = lines.findIndex((l) => l.includes('-->'));
    if (firstCueIdx === -1) return [];

    const blocks = content.slice(content.indexOf(lines[firstCueIdx])).trim().split(/\n\n+/);
    return blocks
      .map((block) => {
        const lines = block.split('\n');
        const timing = lines[0].match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/);
        if (!timing) return null;

        return {
          start: this.parseTime(timing[1]),
          end: this.parseTime(timing[2]),
          text: lines
            .slice(1)
            .join('\n')
            .replace(/<[^>]*>/g, ''),
        };
      })
      .filter((c): c is SubtitleCue => c !== null);
  }

  static parseASS(content: string): SubtitleCue[] {
    const eventsIdx = content.indexOf('[Events]');
    if (eventsIdx === -1) return [];
    const eventsPart = content.slice(eventsIdx);
    const lines = eventsPart.split('\n');
    const dialogueLines = lines.filter((l) => l.startsWith('Dialogue:'));

    return dialogueLines
      .map((line) => {
        const parts = line.split(',');
        if (parts.length < 10) return null;
        const start = parts[1];
        const end = parts[2];
        const text = parts
          .slice(9)
          .join(',')
          .replace(/\{[^}]*\}/g, '')
          .replace(/\\N/g, '\n');

        return {
          start: this.parseTime(start),
          end: this.parseTime(end),
          text: text.trim(),
        };
      })
      .filter((c): c is SubtitleCue => c !== null);
  }

  private static parseTime(str: string): number {
    const parts = str.replace(',', '.').split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }
}
