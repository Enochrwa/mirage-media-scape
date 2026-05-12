import Database from 'better-sqlite3';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import crypto from 'crypto';
import { UrlValidator } from '../utils/UrlValidator';

export class PodcastService {
  private parser: XMLParser;

  constructor(private db: Database.Database) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
  }

  public async subscribe(feedUrl: string) {
    try {
      const url = new URL(feedUrl);

      // Centralized validation for protocol and private IPs
      UrlValidator.validate(feedUrl);

      const response = await fetch(url.href);
      const xml = await response.text();
      const data = this.parser.parse(xml);
      const channel = data.rss.channel;

      const podcastId = crypto.createHash('md5').update(feedUrl).digest('hex');

      this.db.prepare(`
        INSERT OR REPLACE INTO podcast_subscriptions (
          id, title, feed_url, description, artwork_url, author, website, language, subscribed_at, last_fetched
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        podcastId,
        channel.title,
        feedUrl,
        channel.description,
        channel.image?.url || channel["itunes:image"]?.["@_href"],
        channel["itunes:author"] || '',
        channel.link,
        channel.language || 'en',
        Date.now(),
        Date.now()
      );

      const items = Array.isArray(channel.item) ? channel.item : [channel.item];
      const episodeStmt = this.db.prepare(`
        INSERT OR IGNORE INTO podcast_episodes (
          id, podcast_id, guid, title, description, audio_url, published_at, duration
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const episodeId = crypto.createHash('md5').update(item.guid?.["#text"] || item.guid || item.enclosure?.["@_url"]).digest('hex');
        episodeStmt.run(
          episodeId,
          podcastId,
          item.guid?.["#text"] || item.guid || item.enclosure?.["@_url"],
          item.title,
          item.description || item["content:encoded"] || '',
          item.enclosure?.["@_url"],
          item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
          this.parseDuration(item["itunes:duration"])
        );
      }

      return podcastId;
    } catch (e) {
      console.error('Podcast subscription failed:', e);
      throw e;
    }
  }

  private parseDuration(dur: any): number {
    if (!dur) return 0;
    if (typeof dur === 'number') return dur;
    const parts = String(dur).split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

  public async getSubscriptions() {
    return this.db.prepare('SELECT * FROM podcast_subscriptions ORDER BY subscribed_at DESC').all();
  }

  public async getEpisodes(podcastId: string) {
    return this.db.prepare('SELECT * FROM podcast_episodes WHERE podcast_id = ? ORDER BY published_at DESC').all(podcastId);
  }
}
