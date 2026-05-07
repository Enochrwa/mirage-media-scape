import { Clock, Play, Heart, MoreHorizontal } from "lucide-react";
import { useMedia } from "@/contexts/MediaContext";

const tracks = [
  { id: 1, title: "Physical", artist: "Dua Lipa", album: "Future Nostalgia", duration: "3:13", added: "2 days ago" },
  { id: 2, title: "Don't Start Now", artist: "Dua Lipa", album: "Future Nostalgia", duration: "3:03", added: "2 days ago" },
  { id: 3, title: "Levitating", artist: "Dua Lipa", album: "Future Nostalgia", duration: "3:23", added: "3 days ago" },
  { id: 4, title: "Break My Heart", artist: "Dua Lipa", album: "Future Nostalgia", duration: "3:41", added: "1 week ago" },
  { id: 5, title: "Love Again", artist: "Dua Lipa", album: "Future Nostalgia", duration: "4:18", added: "1 week ago" },
];

export function TrackTable() {
  const { playFile } = useMedia();
  return (
    <div className="text-gray-400 px-8 py-4">
      <div className="grid grid-cols-[16px_4fr_3fr_2fr_minmax(120px,1fr)] gap-4 px-4 py-2 border-b border-white/10 text-sm font-medium uppercase tracking-wider mb-4">
        <div>#</div>
        <div>Title</div>
        <div>Album</div>
        <div>Date Added</div>
        <div className="flex justify-end"><Clock className="w-4 h-4" /></div>
      </div>

      <div className="space-y-1">
        {tracks.map((track, i) => (
          <div
            key={track.id}
            onClick={() => playFile({
              id: track.id.toString(),
              title: track.title,
              artist: track.artist,
              album: track.album,
              file: "https://storage.googleapis.com/media-session/elephants-dream/the-wires.mp3",
              type: 'audio',
              bpm: 124,
              camelot_key: '8A'
            })}
            className="grid grid-cols-[16px_4fr_3fr_2fr_minmax(120px,1fr)] gap-4 px-4 py-2 rounded-md hover:bg-white/5 group items-center cursor-pointer transition-colors"
          >
            <div className="text-sm">
              <span className="group-hover:hidden">{i + 1}</span>
              <Play className="w-4 h-4 text-white hidden group-hover:block fill-current" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-800 rounded overflow-hidden">
                <img src={`https://picsum.photos/seed/${track.id}/40/40`} alt="" />
              </div>
              <div>
                <div className="text-white font-medium">{track.title}</div>
                <div className="text-sm">{track.artist}</div>
              </div>
            </div>
            <div className="text-sm truncate">{track.album}</div>
            <div className="text-sm">{track.added}</div>
            <div className="flex items-center justify-end gap-4">
              <Heart className="w-4 h-4 opacity-0 group-hover:opacity-100 hover:text-purple-500 transition-all" />
              <div className="text-sm w-10 text-right">{track.duration}</div>
              <MoreHorizontal className="w-4 h-4 opacity-0 group-hover:opacity-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
