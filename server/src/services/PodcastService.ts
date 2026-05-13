import { Database } from 'better-sqlite3';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import crypto from 'crypto';

export class PodcastService {
  private parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

  constructor(private db: Database) {}

  async subscribe(feedUrl: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(feedUrl, { signal: controller.signal });
    clearTimeout(timeout);
    const xml = await res.text();
    const data = this.parser.parse(xml);

    const channel = data.rss.channel;
    const podcastId = crypto.randomUUID();

    this.db.prepare(`
      INSERT INTO podcast_subscriptions (id, title, feed_url, description, artwork_url, author, subscribed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      podcastId,
      channel.title,
      feedUrl,
      channel.description,
      channel['itunes:image']?.['@_href'],
      channel['itunes:author'],
      Math.floor(Date.now() / 1000)
    );

    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    for (const item of items) {
      this.insertEpisode(podcastId, item);
    }

    return podcastId;
  }

  private insertEpisode(podcastId: string, item: any) {
    const episodeId = item.guid?.['#text'] || item.guid || crypto.randomUUID();
    const pubDate = item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : null;

    let duration = 0;
    const durStr = item['itunes:duration'];
    if (durStr) {
      if (durStr.includes(':')) {
        const parts = durStr.split(':').map(Number);
        if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) duration = parts[0] * 60 + parts[1];
      } else {
        duration = parseInt(durStr);
      }
    }

    this.db.prepare(`
      INSERT OR IGNORE INTO podcast_episodes (id, podcast_id, title, description, audio_url, published_at, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      episodeId,
      podcastId,
      item.title,
      item.description,
      item.enclosure?.['@_url'],
      pubDate,
      duration
    );
  }

  async refreshAll() {
    const podcasts = this.db.prepare('SELECT id, feed_url FROM podcast_subscriptions').all() as any[];
    for (const podcast of podcasts) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(podcast.feed_url, { signal: controller.signal });
      clearTimeout(timeout);
      const xml = await res.text();
      const data = this.parser.parse(xml);
      const items = Array.isArray(data.rss.channel.item) ? data.rss.channel.item : [data.rss.channel.item];

      for (const item of items) {
        this.insertEpisode(podcast.id, item);
      }
    }
  }

  updateProgress(episodeId: string, seconds: number) {
    const ep = this.db.prepare('SELECT duration FROM podcast_episodes WHERE id = ?').get(episodeId) as { duration: number };
    const played = ep && ep.duration > 0 && (seconds / ep.duration) > 0.9 ? 1 : 0;

    this.db.prepare(`
      UPDATE podcast_episodes SET progress_seconds = ?, played = ? WHERE id = ?
    `).run(seconds, played, episodeId);
  }
}
