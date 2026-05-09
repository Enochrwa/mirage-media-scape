import { Clock, Play, Heart, MoreHorizontal } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';

const tracks = [
  {
    id: 1,
    title: 'Physical',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    duration: '3:13',
    added: '2 days ago',
  },
  {
    id: 2,
    title: "Don't Start Now",
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    duration: '3:03',
    added: '2 days ago',
  },
  {
    id: 3,
    title: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    duration: '3:23',
    added: '3 days ago',
  },
  {
    id: 4,
    title: 'Break My Heart',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    duration: '3:41',
    added: '1 week ago',
  },
  {
    id: 5,
    title: 'Love Again',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    duration: '4:18',
    added: '1 week ago',
  },
];

export function TrackTable() {
  const { playFile } = usePlayerStore();
  return (
    <div className="px-8 py-4 text-gray-400">
      <div className="mb-4 grid grid-cols-[16px_4fr_3fr_2fr_minmax(120px,1fr)] gap-4 border-b border-white/10 px-4 py-2 text-sm font-medium uppercase tracking-wider">
        <div>#</div>
        <div>Title</div>
        <div>Album</div>
        <div>Date Added</div>
        <div className="flex justify-end">
          <Clock className="h-4 w-4" />
        </div>
      </div>

      <div className="space-y-1">
        {tracks.map((track, i) => (
          <div
            key={track.id}
            onClick={() =>
              playFile({
                id: track.id.toString(),
                title: track.title,
                artist: track.artist,
                album: track.album,
                file: 'https://storage.googleapis.com/media-session/elephants-dream/the-wires.mp3',
                type: 'audio',
                bpm: 124,
                camelot_key: '8A',
              })
            }
            className="group grid cursor-pointer grid-cols-[16px_4fr_3fr_2fr_minmax(120px,1fr)] items-center gap-4 rounded-md px-4 py-2 transition-colors hover:bg-white/5"
          >
            <div className="text-sm">
              <span className="group-hover:hidden">{i + 1}</span>
              <Play className="hidden h-4 w-4 fill-current text-white group-hover:block" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded bg-zinc-800">
                <img src={`https://picsum.photos/seed/${track.id}/40/40`} alt="" />
              </div>
              <div>
                <div className="font-medium text-white">{track.title}</div>
                <div className="text-sm">{track.artist}</div>
              </div>
            </div>
            <div className="truncate text-sm">{track.album}</div>
            <div className="text-sm">{track.added}</div>
            <div className="flex items-center justify-end gap-4">
              <Heart className="h-4 w-4 opacity-0 transition-all hover:text-purple-500 group-hover:opacity-100" />
              <div className="w-10 text-right text-sm">{track.duration}</div>
              <MoreHorizontal className="h-4 w-4 opacity-0 group-hover:opacity-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
