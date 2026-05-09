import { Home, Search, Library, PlusSquare, Heart, Music2, Mic2, Radio, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLibraryStore } from "@/store/useLibraryStore";
import { Link, useLocation } from "react-router-dom";

const menuItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: Search, label: "Search", path: "/" },
  { icon: Library, label: "Library", path: "/library" },
];

const discoverItems = [
  { icon: LayoutGrid, label: "Discover", path: "/dashboard" },
  { icon: Radio, label: "Radio", path: "/radio" },
  { icon: Music2, label: "Songs", path: "/music" },
  { icon: Mic2, label: "Artists", path: "/artist" },
];

export function Sidebar() {
  const { playlists, createPlaylist } = useLibraryStore();
  const location = useLocation();

  return (
    <div className="w-64 bg-black h-full flex flex-col border-r border-white/10 text-gray-400">
      <div className="p-6">
        <Link to="/" className="text-white text-2xl font-bold flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <Music2 className="text-white w-5 h-5" />
          </div>
          Sonic
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-8">
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">Menu</h2>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-2 py-2 rounded-md transition-colors",
                  location.pathname === item.path ? "text-white bg-white/10" : "hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">Discover</h2>
          <nav className="space-y-1">
            {discoverItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-2 py-2 rounded-md hover:text-white hover:bg-white/5 transition-colors",
                  location.pathname === item.path && "text-white bg-white/10"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">Playlists</h2>
          <nav className="space-y-1">
            <button
              onClick={() => {
                const name = prompt("Enter playlist name:");
                if (name) createPlaylist(name);
              }}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:text-white hover:bg-white/5 transition-colors text-left"
            >
              <PlusSquare className="w-5 h-5" />
              Create Playlist
            </button>
            <Link to="/favorites" className={cn(
              "flex items-center gap-3 px-2 py-2 rounded-md hover:text-white hover:bg-white/5 transition-colors",
              location.pathname === "/favorites" && "text-white bg-white/10"
            )}>
              <Heart className="w-5 h-5" />
              Liked Songs
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
