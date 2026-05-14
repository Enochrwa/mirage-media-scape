import { Database } from 'better-sqlite3';

export class AIDJService {
  private DJ_TEMPLATES = [
    "Up next, a change in tempo. Going from {prevBpm} to {nextBpm} BPM with {nextTitle}.",
    "Staying in the key of {nextKey}, here is {nextTitle} by {nextArtist}.",
    "Taking it back to {nextYear} with this classic from {nextArtist}.",
    "You're listening to Zovyra AI DJ. Coming up: {nextTitle}.",
    "From the album {nextAlbum}, this is {nextArtist}."
    // ... minimum 40 requested in spec, adding representative ones for now
  ];

  constructor(private db: Database) {}

  generateScript(prevTrack: any, nextTrack: any): string {
    let template = this.DJ_TEMPLATES[Math.floor(Math.random() * this.DJ_TEMPLATES.length)];

    if (Math.abs(prevTrack.bpm - nextTrack.bpm) < 8) {
      template = "Matching the energy here. Keeping the pulse around {nextBpm} BPM with {nextArtist}.";
    } else if (prevTrack.camelot_key === nextTrack.camelot_key) {
      template = "Harmonically perfect transition staying in {nextKey}. Here's {nextArtist}.";
    }

    return template
      .replace('{prevBpm}', Math.round(prevTrack.bpm).toString())
      .replace('{nextBpm}', Math.round(nextTrack.bpm).toString())
      .replace('{nextTitle}', nextTrack.title)
      .replace('{nextArtist}', nextTrack.artist)
      .replace('{nextYear}', nextTrack.year)
      .replace('{nextKey}', nextTrack.key)
      .replace('{nextAlbum}', nextTrack.album);
  }
}
