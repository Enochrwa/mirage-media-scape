import { Play, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

const categories = ['Overview', 'Songs', 'Albums', 'Artists', 'Playlists'];

const featuredContent = [
  {
    title: 'Midnight City',
    artist: 'M83',
    image: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80',
    color: 'from-blue-600',
  },
  {
    title: 'Levitating',
    artist: 'Dua Lipa',
    image: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=800&q=80',
    color: 'from-pink-600',
  },
];

export function DiscoverGrid() {
  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-zinc-900 to-black p-8">
      <header className="mb-8 flex items-center justify-between">
        <nav className="flex gap-8">
          {categories.map((cat, i) => (
            <a
              key={cat}
              href="#"
              className={`text-sm font-medium transition-colors ${
                i === 0 ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {cat}
            </a>
          ))}
        </nav>
      </header>

      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Recommended for you</h2>
          <Button variant="link" className="text-gray-400 hover:text-white">
            See all
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {featuredContent.map((item) => (
            <div
              key={item.title}
              className={`relative h-64 overflow-hidden rounded-2xl bg-gradient-to-br ${item.color} group flex cursor-pointer flex-col justify-end to-black/20 p-8`}
            >
              <img
                src={item.image}
                alt={item.title}
                className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-overlay transition-transform duration-500 group-hover:scale-105"
              />
              <div className="relative z-10">
                <p className="mb-1 text-sm font-medium text-white/80">Featured Track</p>
                <h3 className="mb-4 text-4xl font-black text-white">{item.title}</h3>
                <div className="flex items-center gap-4">
                  <Button
                    size="icon"
                    className="rounded-full bg-white text-black hover:bg-gray-200"
                  >
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
        <h2 className="mb-6 text-2xl font-bold text-white">Trending Now</h2>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="group cursor-pointer">
              <div className="relative mb-4 aspect-square overflow-hidden rounded-xl bg-zinc-800">
                <img
                  src={`https://picsum.photos/seed/${i + 20}/400/400`}
                  alt="Playlist"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="icon"
                    className="translate-y-4 transform rounded-full bg-purple-600 text-white transition-transform group-hover:translate-y-0"
                  >
                    <Play className="ml-1 fill-current" />
                  </Button>
                </div>
              </div>
              <h4 className="truncate font-semibold text-white">Daily Mix {i}</h4>
              <p className="truncate text-sm text-gray-500">By Zovyra AI</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
