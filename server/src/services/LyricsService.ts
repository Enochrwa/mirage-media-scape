import Database from 'better-sqlite3';
import fetch from 'node-fetch';
import { Track } from '../types/database';

export interface LyricsRecord {
  track_id: string;
  synced_lyrics: string | null;
  plain_lyrics: string | null;
  source: string;
  fetched_at: number;
}

export class LyricsService {
  constructor(private db: Database.Database) {}

  public async getLyrics(track: Track) {
    // Tier 1 & 2: Check cache
    const cached = this.db
      .prepare('SELECT * FROM lyrics_cache WHERE track_id = ?')
      .get(track.id) as LyricsRecord | undefined;
    if (cached && Date.now() - cached.fetched_at < 30 * 24 * 60 * 60 * 1000) {
      return cached;
    }

    // Tier 3: LRCLIB API
    try {
      const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artist || '')}&track_name=${encodeURIComponent(track.title)}&duration=${Math.round(track.duration || 0)}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = (await response.json()) as { syncedLyrics?: string; plainLyrics?: string };
        const lyrics: LyricsRecord = {
          track_id: track.id,
          synced_lyrics: data.syncedLyrics || null,
          plain_lyrics: data.plainLyrics || null,
          source: 'lrclib',
          fetched_at: Date.now(),
        };

        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO lyrics_cache (track_id, synced_lyrics, plain_lyrics, source, fetched_at)
          VALUES (?, ?, ?, ?, ?)
        `,
          )
          .run(
            lyrics.track_id,
            lyrics.synced_lyrics,
            lyrics.plain_lyrics,
            lyrics.source,
            lyrics.fetched_at,
          );

        return lyrics;
      }
    } catch (e) {
      console.error('LRCLIB fetch failed:', e);
    }

    return cached || null;
  }

  public async translateLyrics(trackId: string, lyrics: string, targetLang: string) {
    try {
      const response = await fetch('https://libretranslate.com/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: lyrics,
          source: 'auto',
          target: targetLang,
          format: 'text',
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { translatedText: string };
        return data.translatedText;
      }
    } catch (e) {
      console.error('Translation failed:', e);
    }
    return null;
  }
}
