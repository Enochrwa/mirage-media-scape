import { Home, Search, Library, PlusSquare, Heart, Music2, Mic2, Radio, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: Home, label: "Home", active: true },
  { icon: Search, label: "Search" },
  { icon: Library, label: "Library" },
];

const discoverItems = [
  { icon: LayoutGrid, label: "Discover" },
  { icon: Radio, label: "Radio" },
  { icon: Music2, label: "Songs" },
  { icon: Mic2, label: "Artists" },
];

const playlistItems = [
  "Your Episodes",
  "Lofi Beats",
  "Today's Top Hits",
  "Discovery Weekly",
];

export function Sidebar() {
  return (
    <div className="w-64 bg-black h-full flex flex-col border-r border-white/10 text-gray-400">
      <div className="p-6">
        <h1 className="text-white text-2xl font-bold flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <Music2 className="text-white w-5 h-5" />
          </div>
          Sonic
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-8">
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">Menu</h2>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <a
                key={item.label}
                href="#"
                className={cn(
                  "flex items-center gap-3 px-2 py-2 rounded-md transition-colors",
                  item.active ? "text-white bg-white/10" : "hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">Discover</h2>
          <nav className="space-y-1">
            {discoverItems.map((item) => (
              <a
                key={item.label}
                href="#"
                className="flex items-center gap-3 px-2 py-2 rounded-md hover:text-white hover:bg-white/5 transition-colors"
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">Playlists</h2>
          <nav className="space-y-1">
            <a href="#" className="flex items-center gap-3 px-2 py-2 rounded-md hover:text-white hover:bg-white/5 transition-colors">
              <PlusSquare className="w-5 h-5" />
              Create Playlist
            </a>
            <a href="#" className="flex items-center gap-3 px-2 py-2 rounded-md hover:text-white hover:bg-white/5 transition-colors">
              <Heart className="w-5 h-5" />
              Liked Songs
            </a>
            <div className="pt-4 border-t border-white/5 mt-4 space-y-1">
              {playlistItems.map((item) => (
                <a
                  key={item}
                  href="#"
                  className="block px-2 py-1 text-sm hover:text-white transition-colors truncate"
                >
                  {item}
                </a>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
