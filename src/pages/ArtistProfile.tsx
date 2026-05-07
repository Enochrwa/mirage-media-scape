import { Play, Shuffle, MoreHorizontal, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrackTable } from "@/components/tracks/TrackTable";

export function ArtistProfile() {
  return (
    <div className="flex-1 bg-black overflow-y-auto">
      {/* Hero Section */}
      <div className="relative h-[40vh] min-h-[300px] flex flex-col justify-end p-8 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1514525253361-9134b223d6a2?w=1600&q=80")' }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500 fill-current" />
            <span className="text-sm font-medium">Verified Artist</span>
          </div>
          <h1 className="text-8xl font-black mb-6">Dua Lipa</h1>
          <p className="text-gray-300 mb-2">72,432,109 monthly listeners</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="p-8 flex items-center gap-6">
        <Button size="lg" className="rounded-full bg-purple-600 hover:bg-purple-700 h-14 w-14 p-0">
          <Play className="fill-current ml-1 w-6 h-6" />
        </Button>
        <Button variant="outline" className="rounded-full px-8 py-6 border-white/20 hover:bg-white/10 uppercase tracking-widest text-xs font-bold">
          Following
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-400">
          <MoreHorizontal className="w-8 h-8" />
        </Button>
      </div>

      {/* Popular Tracks */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold px-8 mb-4">Popular</h2>
        <TrackTable />
      </section>

      {/* Artist Pick */}
      <section className="px-8 mb-12">
        <h2 className="text-2xl font-bold mb-4">Artist Pick</h2>
        <div className="flex gap-4 items-center">
          <div className="w-20 h-20 rounded-md overflow-hidden bg-zinc-800">
            <img src="https://picsum.photos/seed/dua/80/80" alt="Album Art" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
                <img src="https://picsum.photos/seed/dua/24/24" alt="" />
              </div>
              <span className="text-xs text-gray-400">Post by Dua Lipa</span>
            </div>
            <h4 className="font-bold">Dua Lipa Best Of</h4>
            <p className="text-sm text-gray-400">Playlist</p>
          </div>
        </div>
      </section>
    </div>
  );
}
