import type { Database } from 'better-sqlite3';

interface TrackInfo {
  bpm: number;
  camelot_key?: string;
  title: string;
  artist: string;
  album?: string;
  year?: string | number;
  key?: string;
}

export class AIDJService {
  private DJ_TEMPLATES = [
    'Up next, a change in tempo. Going from {prevBpm} to {nextBpm} BPM with {nextTitle}.',
    'Staying in the key of {nextKey}, here is {nextTitle} by {nextArtist}.',
    'Taking it back to {nextYear} with this classic from {nextArtist}.',
    "You're listening to Zovyra AI DJ. Coming up: {nextTitle}.",
    'From the album {nextAlbum}, this is {nextArtist}.',
    'An absolute gem coming your way — {nextTitle} by {nextArtist}.',
    'Next up, {nextArtist} with a track at {nextBpm} BPM.',
    "Here's one that never gets old: {nextTitle}.",
    'Buckle up — {nextArtist} is about to take it to the next level.',
    'Keeping the vibe alive with {nextTitle} from {nextArtist}.',
  ];

  constructor(private db: Database) {}

  generateScript(prevTrack: TrackInfo, nextTrack: TrackInfo): string {
    let template = this.DJ_TEMPLATES[Math.floor(Math.random() * this.DJ_TEMPLATES.length)];

    if (Math.abs(prevTrack.bpm - nextTrack.bpm) < 8) {
      template =
        'Matching the energy here. Keeping the pulse around {nextBpm} BPM with {nextArtist}.';
    } else if (prevTrack.camelot_key && prevTrack.camelot_key === nextTrack.camelot_key) {
      template = "Harmonically perfect transition staying in {nextKey}. Here's {nextArtist}.";
    }

    return template
      .replace('{prevBpm}', Math.round(prevTrack.bpm).toString())
      .replace('{nextBpm}', Math.round(nextTrack.bpm).toString())
      .replace('{nextTitle}', nextTrack.title ?? 'Unknown Title')
      .replace('{nextArtist}', nextTrack.artist ?? 'Unknown Artist')
      .replace('{nextYear}', nextTrack.year != null ? String(nextTrack.year) : 'the past')
      .replace('{nextKey}', nextTrack.key ?? nextTrack.camelot_key ?? 'this key')
      .replace('{nextAlbum}', nextTrack.album ?? 'this album');
  }
}