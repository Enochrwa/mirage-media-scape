import { client } from '@/api/client';
import { LyricLine, parseLRC } from './lyrics-parser';

export interface LyricsRecord {
  track_id: string;
  synced_lyrics: string | null;
  plain_lyrics: string | null;
  source: string;
  fetched_at: number;
}

export type { LyricLine };

export class LyricsService {
  static async getLyrics(trackId: string): Promise<LyricLine[] | null> {
    try {
      const data = await client.get(`/tracks/${trackId}/lyrics`);

      if (data && data.synced_lyrics) {
        return parseLRC(data.synced_lyrics);
      } else if (data && data.plain_lyrics) {
        // Fallback for plain lyrics
        return data.plain_lyrics.split('\n').map((line: string) => ({
          time: 0,
          text: line.trim(),
        }));
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch lyrics from server:', error);
      return null;
    }
  }
}
