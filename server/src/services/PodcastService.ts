import type { Database } from 'better-sqlite3';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import crypto from 'crypto';

interface PodcastItem {
  guid?: string | { '#text'?: string };
  pubDate?: string;
  title?: string;
  description?: string;
  enclosure?: { '@_url'?: string };
  'itunes:duration'?: string;
}

interface ParsedChannel {
  title?: string;
  description?: string;
  'itunes:image'?: { '@_href'?: string };
  'itunes:author'?: string;
  item?: PodcastItem | PodcastItem[];
}

interface ParsedFeed {
  rss?: { channel?: ParsedChannel };
}

export class PodcastService {
  private parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

  constructor(private db: Database) {}

  async subscribe(feedUrl: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let res;
    try {
      res = await fetch(feedUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    const xml = await res.text();
    const data = this.parser.parse(xml) as ParsedFeed;
    const channel = data.rss?.channel;
    if (!channel) throw new Error('Invalid RSS feed: missing channel');

    const podcastId = crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO podcast_subscriptions
           (id, title, feed_url, description, artwork_url, author, subscribed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        podcastId,
        channel.title ?? null,
        feedUrl,
        channel.description ?? null,
        channel['itunes:image']?.['@_href'] ?? null,
        channel['itunes:author'] ?? null,
        Math.floor(Date.now() / 1000),
      );

    const rawItems = channel.item;
    const items: PodcastItem[] = rawItems ? (Array.isArray(rawItems) ? rawItems : [rawItems]) : [];

    for (const item of items) {
      this.insertEpisode(podcastId, item);
    }

    return podcastId;
  }

  private insertEpisode(podcastId: string, item: PodcastItem): void {
    const episodeId =
      typeof item.guid === 'object'
        ? (item.guid['#text'] ?? crypto.randomUUID())
        : (item.guid ?? crypto.randomUUID());

    const pubDate = item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : null;

    let duration = 0;
    const durStr = item['itunes:duration'];
    if (durStr) {
      if (durStr.includes(':')) {
        const parts = durStr.split(':').map(Number);
        if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) duration = parts[0] * 60 + parts[1];
      } else {
        duration = parseInt(durStr, 10);
      }
    }

    this.db
      .prepare(
        `INSERT OR IGNORE INTO podcast_episodes
           (id, podcast_id, title, description, audio_url, published_at, duration)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        episodeId,
        podcastId,
        item.title ?? null,
        item.description ?? null,
        item.enclosure?.['@_url'] ?? null,
        pubDate,
        duration,
      );
  }

  async refreshAll(): Promise<void> {
    const podcasts = this.db
      .prepare('SELECT id, feed_url FROM podcast_subscriptions')
      .all() as Array<{ id: string; feed_url: string }>;

    for (const podcast of podcasts) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(podcast.feed_url, { signal: controller.signal });
        const xml = await res.text();
        const data = this.parser.parse(xml) as ParsedFeed;
        const rawItems = data.rss?.channel?.item;
        const items: PodcastItem[] = rawItems
          ? Array.isArray(rawItems)
            ? rawItems
            : [rawItems]
          : [];

        for (const item of items) {
          this.insertEpisode(podcast.id, item);
        }
      } catch (e) {
        console.error(`Failed to refresh podcast ${podcast.id}:`, e);
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  updateProgress(episodeId: string, seconds: number): void {
    const ep = this.db
      .prepare('SELECT duration FROM podcast_episodes WHERE id = ?')
      .get(episodeId) as { duration: number } | undefined;

    const played = ep && ep.duration > 0 && seconds / ep.duration > 0.9 ? 1 : 0;

    this.db
      .prepare(`UPDATE podcast_episodes SET progress_seconds = ?, played = ? WHERE id = ?`)
      .run(seconds, played, episodeId);
  }
}
