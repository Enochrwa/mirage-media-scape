const DJ_SCRIPTS = [
  "That was {prevArtist} with {prevTitle}. Coming up — {artist}.",
  "Keeping the energy at {bpm} BPM, here's {title} by {artist}.",
  "From {year} — {artist}, {title}.",
  "Next up in your mix: {artist}.",
  "Switching from {prevKey} to {key} — {artist} with {title}.",
  "Here's a {year} classic: {artist} — {title}.",
  "BPM dropping from {prevBpm} to {bpm} — {artist}.",
  "If you liked {prevArtist}, you'll love this — {artist}, {title}.",
  "Taking it back to {year}. This is {artist}.",
  "You're listening to Zovyra AI DJ. Up next: {artist}.",
  "Stay tuned for {title} by {artist}, coming in hot.",
  "Transitioning nicely into {key} harmonic mix. Here's {artist}.",
  "Let's keep this vibe going with {artist}.",
  "A little bit of {genre} for your ears. {artist} — {title}.",
  "This one's been getting a lot of plays lately. {artist}.",
  "Freshly added to your library. {artist} with {title}.",
  "A deep cut from {album}. {artist}.",
  "Smooth transitions only. {artist} is next.",
  "Bringing the tempo to {bpm}. {artist}.",
  "Classic vibes from {artist}. Enjoy.",
  "One of my favorites from {year}. {artist}.",
  "Mixing it up with {artist}.",
  "The rhythm continues with {title}.",
  "Up next, a track that fits your current mood. {artist}.",
  "Energy level rising. Here's {artist}.",
  "Chilling out with some {genre}. {artist}.",
  "From the album {album}, this is {title}.",
  "Keep those headphones on. {artist} is up.",
  "The perfect follow-up to {prevArtist}. {artist}.",
  "Your personal Zovyra mix. {artist} — {title}.",
  "Let's move from {prevBpm} to {bpm} BPM.",
  "Harmonic shift to {key}. {artist}.",
  "Active since {year}, {artist} still brings the heat.",
  "You requested it, or at least your history did. {artist}.",
  "Never a dull moment with {artist}.",
  "The beat goes on. {title}.",
  "Zovyra exclusive vibes. {artist}.",
  "A masterpiece from {year}. {artist}.",
  "Rounding out this set with {artist}.",
  "Thanks for listening. Here's {artist}."
];

export class AIDJService {
  private lastScripts: string[] = [];

  public generateIntro(prevTrack: any, nextTrack: any) {
    let bestScript = DJ_SCRIPTS[Math.floor(Math.random() * DJ_SCRIPTS.length)];

    // Placeholder replacement
    let intro = bestScript
      .replace(/{prevArtist}/g, prevTrack?.artist || 'the previous artist')
      .replace(/{prevTitle}/g, prevTrack?.title || 'the last song')
      .replace(/{artist}/g, nextTrack?.artist || 'Unknown Artist')
      .replace(/{title}/g, nextTrack?.title || 'this next track')
      .replace(/{bpm}/g, Math.round(nextTrack?.bpm || 120).toString())
      .replace(/{prevBpm}/g, Math.round(prevTrack?.bpm || 120).toString())
      .replace(/{year}/g, (nextTrack?.year || 'recent times').toString())
      .replace(/{key}/g, nextTrack?.camelot_key || nextTrack?.key || 'a new key')
      .replace(/{prevKey}/g, prevTrack?.camelot_key || prevTrack?.key || 'the previous key')
      .replace(/{genre}/g, nextTrack?.genre || 'music')
      .replace(/{album}/g, nextTrack?.album || 'their latest work');

    return intro;
  }
}
