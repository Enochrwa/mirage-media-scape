import { Play, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

const categories = ["Overview", "Songs", "Albums", "Artists", "Playlists"];

const featuredContent = [
  {
    title: "Midnight City",
    artist: "M83",
    image: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80",
    color: "from-blue-600",
  },
  {
    title: "Levitating",
    artist: "Dua Lipa",
    image: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=800&q=80",
    color: "from-pink-600",
  },
];

export function DiscoverGrid() {
  return (
    <div className="flex-1 bg-gradient-to-b from-zinc-900 to-black overflow-y-auto p-8">
      <header className="flex items-center justify-between mb-8">
        <nav className="flex gap-8">
          {categories.map((cat, i) => (
            <a
              key={cat}
              href="#"
              className={`text-sm font-medium transition-colors ${
                i === 0 ? "text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {cat}
            </a>
          ))}
        </nav>
      </header>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Recommended for you</h2>
          <Button variant="link" className="text-gray-400 hover:text-white">See all</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {featuredContent.map((item) => (
            <div
              key={item.title}
              className={`relative h-64 rounded-2xl overflow-hidden bg-gradient-to-br ${item.color} to-black/20 p-8 flex flex-col justify-end group cursor-pointer`}
            >
              <img
                src={item.image}
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50 group-hover:scale-105 transition-transform duration-500"
              />
              <div className="relative z-10">
                <p className="text-sm font-medium text-white/80 mb-1">Featured Track</p>
                <h3 className="text-4xl font-black text-white mb-4">{item.title}</h3>
                <div className="flex items-center gap-4">
                  <Button size="icon" className="rounded-full bg-white text-black hover:bg-gray-200">
                    <Play className="fill-current" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-white">
                    <MoreHorizontal />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-white mb-6">Trending Now</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="group cursor-pointer">
              <div className="aspect-square rounded-xl bg-zinc-800 mb-4 overflow-hidden relative">
                <img
                  src={`https://picsum.photos/seed/${i + 20}/400/400`}
                  alt="Playlist"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button size="icon" className="rounded-full bg-purple-600 text-white transform translate-y-4 group-hover:translate-y-0 transition-transform">
                    <Play className="fill-current ml-1" />
                  </Button>
                </div>
              </div>
              <h4 className="font-semibold text-white truncate">Daily Mix {i}</h4>
              <p className="text-sm text-gray-500 truncate">By Sonic AI</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
