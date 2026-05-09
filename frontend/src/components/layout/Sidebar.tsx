import {
  Home,
  Search,
  Library,
  PlusSquare,
  Heart,
  Music2,
  Mic2,
  Radio,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLibraryStore } from '@/store/useLibraryStore';
import { Link, useLocation } from 'react-router-dom';

const menuItems = [
  { icon: Home, label: 'Home', path: '/home' },
  { icon: Search, label: 'Search', path: '/' },
  { icon: Library, label: 'Library', path: '/library' },
];

const discoverItems = [
  { icon: LayoutGrid, label: 'Discover', path: '/dashboard' },
  { icon: Radio, label: 'Radio', path: '/radio' },
  { icon: Music2, label: 'Songs', path: '/music' },
  { icon: Mic2, label: 'Artists', path: '/artist' },
];

export function Sidebar() {
  const { playlists, createPlaylist } = useLibraryStore();
  const location = useLocation();

  return (
    <div className="flex h-full w-64 flex-col border-r border-white/10 bg-black text-gray-400">
      <div className="p-6">
        <Link to="/" className="flex items-center gap-2 text-2xl font-bold text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
            <Music2 className="h-5 w-5 text-white" />
          </div>
          Sonic
        </Link>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto px-4">
        <div>
          <h2 className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Menu
          </h2>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-2 transition-colors',
                  location.pathname === item.path
                    ? 'bg-white/10 text-white'
                    : 'hover:bg-white/5 hover:text-white',
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Discover
          </h2>
          <nav className="space-y-1">
            {discoverItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/5 hover:text-white',
                  location.pathname === item.path && 'bg-white/10 text-white',
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Playlists
          </h2>
          <nav className="space-y-1">
            <button
              onClick={() => {
                const name = prompt('Enter playlist name:');
                if (name) createPlaylist(name);
              }}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/5 hover:text-white"
            >
              <PlusSquare className="h-5 w-5" />
              Create Playlist
            </button>
            <Link
              to="/favorites"
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/5 hover:text-white',
                location.pathname === '/favorites' && 'bg-white/10 text-white',
              )}
            >
              <Heart className="h-5 w-5" />
              Liked Songs
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
