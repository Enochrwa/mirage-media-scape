export interface LyricLine {
  time: number;
  text: string;
}

export class LyricsService {
  private static LRCLIB_API = 'https://lrclib.net/api';

  static async getLyrics(artist: string, title: string): Promise<LyricLine[] | null> {
    try {
      const url = `${this.LRCLIB_API}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
      const response = await fetch(url);

      if (!response.ok) return null;

      const data = await response.json();
      if (data.syncedLyrics) {
        return this.parseLRC(data.syncedLyrics);
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch lyrics:', error);
      return null;
    }
  }

  private static parseLRC(lrc: string): LyricLine[] {
    return lrc
      .split('\n')
      .map((line) => {
        const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
        if (!match) return null;

        const mins = parseInt(match[1]);
        const secs = parseInt(match[2]);
        const ms = parseInt(match[3]);
        const time = mins * 60 + secs + ms / (match[3].length === 3 ? 1000 : 100);
        const text = match[4].trim();

        return { time, text };
      })
      .filter((line): line is LyricLine => line !== null);
  }
}
