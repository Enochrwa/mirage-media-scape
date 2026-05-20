export interface LyricWord {
  time: number;
  text: string;
}

export interface LyricLine {
  time: number;
  text: string;
  words?: LyricWord[];
}

/**
 * Parses LRC format (standard and enhanced) into a structured LyricLine array.
 */
export function parseLRC(lrc: string): LyricLine[] {
  const lines = lrc.split('\n');
  const cues: LyricLine[] = [];
  // Pattern for standard LRC: [00:00.00] text
  const linePattern = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
  // Pattern for enhanced LRC words: <00:00.00>
  const wordPattern = /<(\d{2}):(\d{2})\.(\d{2,3})>([^\s<]+)/g;

  for (const line of lines) {
    const lineMatch = line.match(linePattern);
    if (lineMatch) {
      const minutes = parseInt(lineMatch[1]);
      const seconds = parseInt(lineMatch[2]);
      const centiseconds = parseInt(lineMatch[3].padEnd(3, '0').slice(0, 3));
      const lineTime = minutes * 60 + seconds + centiseconds / 1000;
      const content = lineMatch[4].trim();

      const words: LyricWord[] = [];
      let wordMatch;
      while ((wordMatch = wordPattern.exec(content)) !== null) {
        const wMinutes = parseInt(wordMatch[1]);
        const wSeconds = parseInt(wordMatch[2]);
        const wCentiseconds = parseInt(wordMatch[3].padEnd(3, '0').slice(0, 3));
        words.push({
          time: wMinutes * 60 + wSeconds + wCentiseconds / 1000,
          text: wordMatch[4],
        });
      }

      // If no enhanced word timings, treat as standard line
      // Strip tags for text display
      const text = content.replace(/<[^>]+>/g, '').trim();

      cues.push({ time: lineTime, text, words: words.length > 0 ? words : undefined });
    }
  }

  return cues.sort((a, b) => a.time - b.time);
}
