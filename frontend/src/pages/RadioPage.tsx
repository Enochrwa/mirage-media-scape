import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import MobileTopBar from '@/components/MobileTopBar';
import { cn, API_BASE } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Radio,
  Search,
  Play,
  Globe,
  Zap,
  Moon,
  Heart,
  Smile,
  Music2,
  Loader2,
  Pause,
  Star,
  TrendingUp,
  MapPin,
  RefreshCw,
  Coffee,
  Waves,
  Flame,
  Headphones,
} from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useRadioNowPlaying } from '@/hooks/useRadioNowPlaying';

interface RadioStation {
  stationuuid: string;
  name: string;
  country: string;
  countrycode: string;
  url_resolved: string;
  /** Raw, unresolved URL from radio-browser.info — often a mirror/redirect
   * target distinct from url_resolved; used as a fallback by the stream
   * proxy when the resolved URL's connection can't be (re)established. */
  url?: string;
  favicon?: string;
  tags?: string;
  bitrate?: number;
  votes?: number;
  language?: string;
  clickcount?: number;
  codec?: string;
}

const MOOD_TAGS: Record<string, { tags: string[]; icon: React.ReactNode; gradient: string }> = {
  Focus: {
    tags: ['study', 'focus', 'classical', 'ambient', 'concentration'],
    icon: <Coffee size={28} />,
    gradient: 'from-blue-600/80 to-indigo-700/80',
  },
  Chill: {
    tags: ['chill', 'lounge', 'smooth jazz', 'relaxing'],
    icon: <Waves size={28} />,
    gradient: 'from-teal-600/80 to-cyan-700/80',
  },
  Workout: {
    tags: ['workout', 'electronic', 'dance', 'energy', 'edm'],
    icon: <Flame size={28} />,
    gradient: 'from-orange-600/80 to-red-700/80',
  },
  Sleep: {
    tags: ['sleep', 'ambient', 'nature', 'meditation', 'calm'],
    icon: <Moon size={28} />,
    gradient: 'from-indigo-800/80 to-purple-900/80',
  },
  Party: {
    tags: ['party', 'dance', 'pop', 'hits', 'top40'],
    icon: <Smile size={28} />,
    gradient: 'from-pink-600/80 to-fuchsia-700/80',
  },
  Jazz: {
    tags: ['jazz', 'blues', 'soul', 'swing'],
    icon: <Music2 size={28} />,
    gradient: 'from-amber-700/80 to-yellow-700/80',
  },
  Rock: {
    tags: ['rock', 'metal', 'alternative', 'indie'],
    icon: <Zap size={28} />,
    gradient: 'from-zinc-700/80 to-zinc-900/80',
  },
  Latin: {
    tags: ['latin', 'salsa', 'reggaeton', 'bachata'],
    icon: <Heart size={28} />,
    gradient: 'from-red-600/80 to-orange-700/80',
  },
};

// Country list for "local stations" tab
const COUNTRY_CODES = [
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'GB', name: 'UK', flag: '🇬🇧' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
];

const RADIO_BROWSER_HOSTS = [
  'de1.api.radio-browser.info',
  'nl1.api.radio-browser.info',
  'at1.api.radio-browser.info',
];

async function radioBrowserFetch(path: string): Promise<RadioStation[]> {
  for (const host of RADIO_BROWSER_HOSTS) {
    try {
      const res = await fetch(`https://${host}/json/${path}`, {
        headers: { 'User-Agent': 'Zovyra/1.0' },
      });
      if (res.ok) return res.json();
    } catch {
      /* try next */
    }
  }
  return [];
}

const StationCard: React.FC<{
  station: RadioStation;
  isPlaying: boolean;
  isReconnecting: boolean;
  isFavorite: boolean;
  onPlay: (s: RadioStation) => void;
  onToggleFavorite: (s: RadioStation) => void;
}> = ({ station, isPlaying, isReconnecting, isFavorite, onPlay, onToggleFavorite }) => (
  <Card
    className={cn(
      'group relative overflow-hidden border transition-all duration-200 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10',
      isPlaying
        ? 'border-purple-500/60 bg-purple-500/10 shadow-md shadow-purple-500/20'
        : 'border-white/5 bg-zinc-900/50',
    )}
  >
    <div className="flex items-center gap-3 p-3">
      {/* Logo / Icon */}
      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
        {station.favicon ? (
          <img
            src={station.favicon}
            className="h-full w-full object-contain p-1"
            alt=""
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600/30 to-fuchsia-600/30">
            <Radio className="text-purple-400" size={22} />
          </div>
        )}
        {/* Play overlay */}
        <button
          onClick={() => onPlay(station)}
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
        >
          {isPlaying ? (
            <Pause size={18} className="fill-current text-white" />
          ) : (
            <Play size={18} className="fill-current text-white" />
          )}
        </button>
        {/* Live pulse */}
        {isPlaying && (
          <span
            className={cn(
              'absolute bottom-1 right-1 h-2 w-2 rounded-full shadow-sm',
              isReconnecting
                ? 'bg-amber-400 shadow-amber-400/80'
                : 'bg-green-400 shadow-green-400/80',
            )}
          >
            <span
              className={cn(
                'absolute inset-0 animate-ping rounded-full',
                isReconnecting ? 'bg-amber-400/60' : 'bg-green-400/60',
              )}
            />
          </span>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold leading-tight text-white">{station.name}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-400">
          <Globe size={9} /> {station.country || station.countrycode}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {station.bitrate ? (
            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-500">
              {station.bitrate}k
            </span>
          ) : null}
          {station.codec ? (
            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] uppercase text-zinc-500">
              {station.codec}
            </span>
          ) : null}
          {isPlaying && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                isReconnecting
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-green-500/20 text-green-400',
              )}
            >
              {isReconnecting ? '◌ RECONNECTING' : '● LIVE'}
            </span>
          )}
        </div>
      </div>

      {/* Favorite toggle */}
      <button
        onClick={() => onToggleFavorite(station)}
        className={cn(
          'flex-shrink-0 rounded-full p-1.5 transition-colors',
          isFavorite ? 'text-red-400 hover:text-red-300' : 'text-zinc-600 hover:text-zinc-300',
        )}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>

      {/* Vote count */}
      {station.votes != null && station.votes > 0 && (
        <div className="hidden flex-col items-center text-zinc-600 sm:flex">
          <Star size={11} className="text-yellow-600/50" />
          <span className="text-[9px]">
            {station.votes > 999 ? `${(station.votes / 1000).toFixed(1)}k` : station.votes}
          </span>
        </div>
      )}
    </div>
  </Card>
);

const RadioPage = () => {
  const { currentFile, isPlaying, playFile } = usePlayerStore();
  const { isReconnecting } = useRadioNowPlaying(currentFile);
  const [activeTab, setActiveTab] = useState<
    'local' | 'trending' | 'mood' | 'country' | 'search' | 'favorites'
  >('local');
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [trendingStations, setTrendingStations] = useState<RadioStation[]>([]);
  const [moodStations, setMoodStations] = useState<RadioStation[]>([]);
  const [favoriteStations, setFavoriteStations] = useState<RadioStation[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]); // Rwanda default
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Update playingId when store changes
  useEffect(() => {
    if (currentFile?.id && isPlaying) setPlayingId(currentFile.id);
    else if (!isPlaying) setPlayingId(null);
  }, [currentFile?.id, isPlaying]);

  // Load Rwanda (local) stations and saved favorites on mount
  useEffect(() => {
    loadLocalStations('RW');
    loadTrending();
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/radio/favorites`);
      const { data } = (await res.json()) as {
        data: { stationuuid: string; name: string; url: string; favicon?: string }[];
      };
      setFavoriteIds(new Set(data.map((f) => f.stationuuid)));
      setFavoriteStations(
        data.map((f) => ({
          stationuuid: f.stationuuid,
          name: f.name,
          country: '',
          countrycode: '',
          url_resolved: f.url,
          favicon: f.favicon,
        })),
      );
    } catch {
      /* favorites are a nice-to-have; fail silently */
    }
  };

  const toggleFavorite = useCallback(
    async (station: RadioStation) => {
      const wasFavorite = favoriteIds.has(station.stationuuid);
      // Optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(station.stationuuid);
        else next.add(station.stationuuid);
        return next;
      });
      setFavoriteStations((prev) =>
        wasFavorite
          ? prev.filter((s) => s.stationuuid !== station.stationuuid)
          : [station, ...prev.filter((s) => s.stationuuid !== station.stationuuid)],
      );
      try {
        const res = await fetch(`${API_BASE}/api/radio/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stationuuid: station.stationuuid,
            name: station.name,
            url: station.url_resolved,
            favicon: station.favicon,
          }),
        });
        if (!res.ok) throw new Error('favorite request failed');
        const { data } = (await res.json()) as { data: { favorited: boolean } };
        // Reconcile with the server's authoritative result in case it
        // disagrees with our optimistic guess (e.g. two tabs toggling the
        // same station, or the station had no playable URL to save).
        if (data.favorited !== !wasFavorite) {
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            if (data.favorited) next.add(station.stationuuid);
            else next.delete(station.stationuuid);
            return next;
          });
          if (!data.favorited) {
            setFavoriteStations((prev) =>
              prev.filter((s) => s.stationuuid !== station.stationuuid),
            );
          }
        }
      } catch {
        // Revert on failure
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(station.stationuuid);
          else next.delete(station.stationuuid);
          return next;
        });
        loadFavorites();
      }
    },
    [favoriteIds],
  );

  const loadLocalStations = async (countryCode: string) => {
    setLoading(true);
    try {
      const data = await radioBrowserFetch(
        `stations/bycountrycodeexact/${countryCode}?limit=50&order=votes&reverse=true&hidebroken=true`,
      );
      setStations(data);
    } catch {
      setStations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTrending = async () => {
    try {
      const data = await radioBrowserFetch(
        'stations/topclick/60?hidebroken=true&order=clickcount&reverse=true',
      );
      setTrendingStations(data);
    } catch {
      /* silent */
    }
  };

  const loadMoodStations = async (mood: string) => {
    setLoading(true);
    const tags = MOOD_TAGS[mood]?.tags ?? [mood.toLowerCase()];
    try {
      const results = await Promise.all(
        tags
          .slice(0, 2)
          .map((tag) =>
            radioBrowserFetch(
              `stations/bytag/${encodeURIComponent(tag)}?limit=20&hidebroken=true&order=votes&reverse=true`,
            ),
          ),
      );
      const combined = Array.from(
        new Map(results.flat().map((s) => [s.stationuuid, s])).values(),
      ).slice(0, 40);
      setMoodStations(combined);
    } catch {
      setMoodStations([]);
    } finally {
      setLoading(false);
    }
  };

  const searchStations = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await radioBrowserFetch(
        `stations/byname/${encodeURIComponent(query.trim())}?limit=40&hidebroken=true`,
      );
      setStations(data);
    } catch {
      setStations([]);
    } finally {
      setLoading(false);
    }
  };

  const playStation = useCallback(
    (station: RadioStation) => {
      playFile({
        id: station.stationuuid,
        title: station.name,
        artist: `${station.country} Radio`,
        file: station.url_resolved,
        type: 'audio',
        cover: station.favicon || '',
        album: 'Radio',
        isStream: true,
        streamFallbackUrl:
          station.url && station.url !== station.url_resolved ? station.url : undefined,
      });
      setPlayingId(station.stationuuid);
    },
    [playFile],
  );

  const handleCountryChange = (country: (typeof COUNTRY_CODES)[0]) => {
    setSelectedCountry(country);
    loadLocalStations(country.code);
  };

  const tabs = [
    { id: 'local', label: '🇷🇼 Local' },
    { id: 'trending', label: '🔥 Trending' },
    { id: 'mood', label: '🎭 Mood' },
    { id: 'country', label: '🌍 By Country' },
    { id: 'search', label: '🔍 Search' },
    { id: 'favorites', label: '❤️ Favorites' },
  ] as const;

  return (
    <MainLayout>
      <MobileTopBar title="Radio" />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold tracking-tight text-white md:text-3xl">Radio</h1>
            <p className="text-sm text-zinc-400">
              Live stations from around the world — local, trending, by mood or country.
            </p>
          </div>
          {activeTab === 'local' && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-zinc-400 hover:text-white"
              onClick={() => loadLocalStations(selectedCountry.code)}
            >
              <RefreshCw size={13} /> Refresh
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-white/8 flex gap-1 overflow-x-auto border-b pb-px no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'trending' && trendingStations.length === 0) loadTrending();
              }}
              className={cn(
                'whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-b-2 border-purple-500 text-white'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* LOCAL TAB */}
        {activeTab === 'local' && (
          <div className="space-y-4 duration-200 animate-in fade-in">
            {/* Country switcher within local */}
            <div className="flex flex-wrap items-center gap-2">
              <MapPin size={13} className="text-zinc-500" />
              <span className="mr-1 text-xs text-zinc-500">Region:</span>
              {COUNTRY_CODES.slice(0, 8).map((c) => (
                <button
                  key={c.code}
                  onClick={() => handleCountryChange(c)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    selectedCountry.code === c.code
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {c.flag} {c.name}
                </button>
              ))}
            </div>

            {loading ? (
              <LoadingGrid />
            ) : stations.length === 0 ? (
              <EmptyStations label={`No stations found for ${selectedCountry.name}`} />
            ) : (
              <>
                <p className="text-xs text-zinc-600">{stations.length} stations found</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {stations.map((s) => (
                    <StationCard
                      key={s.stationuuid}
                      station={s}
                      isPlaying={playingId === s.stationuuid}
                      isReconnecting={isReconnecting && playingId === s.stationuuid}
                      isFavorite={favoriteIds.has(s.stationuuid)}
                      onPlay={playStation}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* TRENDING TAB */}
        {activeTab === 'trending' && (
          <div className="space-y-4 duration-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-orange-400" />
              <span className="text-sm text-zinc-400">
                Most-listened stations right now worldwide
              </span>
            </div>
            {trendingStations.length === 0 ? (
              <LoadingGrid />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {trendingStations.map((s) => (
                  <StationCard
                    key={s.stationuuid}
                    station={s}
                    isPlaying={playingId === s.stationuuid}
                    isReconnecting={isReconnecting && playingId === s.stationuuid}
                    isFavorite={favoriteIds.has(s.stationuuid)}
                    onPlay={playStation}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* MOOD TAB */}
        {activeTab === 'mood' && (
          <div className="space-y-6 duration-200 animate-in fade-in">
            {!selectedMood ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {Object.entries(MOOD_TAGS).map(([mood, cfg]) => (
                  <button
                    key={mood}
                    onClick={() => {
                      setSelectedMood(mood);
                      loadMoodStations(mood);
                    }}
                    className={cn(
                      'group flex flex-col items-center justify-center gap-3 rounded-2xl p-6 text-white transition-all hover:scale-[1.03] hover:shadow-xl',
                      `bg-gradient-to-br ${cfg.gradient}`,
                    )}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/20 transition-transform group-hover:scale-110">
                      {cfg.icon}
                    </div>
                    <span className="font-semibold">{mood}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedMood(null);
                      setMoodStations([]);
                    }}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300 hover:bg-white/20"
                  >
                    ← Back to moods
                  </button>
                  <h2 className="text-lg font-bold text-white">{selectedMood} Radio</h2>
                </div>
                {loading ? (
                  <LoadingGrid />
                ) : moodStations.length === 0 ? (
                  <EmptyStations label="No mood stations found" />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {moodStations.map((s) => (
                      <StationCard
                        key={s.stationuuid}
                        station={s}
                        isPlaying={playingId === s.stationuuid}
                        isReconnecting={isReconnecting && playingId === s.stationuuid}
                        isFavorite={favoriteIds.has(s.stationuuid)}
                        onPlay={playStation}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* COUNTRY TAB */}
        {activeTab === 'country' && (
          <div className="space-y-5 duration-200 animate-in fade-in">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8">
              {COUNTRY_CODES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => {
                    handleCountryChange(c);
                    setActiveTab('local');
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 p-3 text-center transition-all hover:scale-[1.04] hover:bg-purple-600/20"
                >
                  <span className="text-2xl">{c.flag}</span>
                  <span className="text-[10px] leading-tight text-zinc-400">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <div className="space-y-5 duration-200 animate-in fade-in">
            <div className="flex max-w-lg gap-2">
              <Input
                placeholder="Search station name, genre, country…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchStations()}
                className="border-white/10 bg-zinc-900 text-white placeholder:text-zinc-600"
              />
              <Button
                onClick={searchStations}
                disabled={loading}
                className="gap-1.5 bg-purple-600 hover:bg-purple-500"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Search
              </Button>
            </div>
            {loading ? (
              <LoadingGrid />
            ) : stations.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {stations.map((s) => (
                  <StationCard
                    key={s.stationuuid}
                    station={s}
                    isPlaying={playingId === s.stationuuid}
                    isReconnecting={isReconnecting && playingId === s.stationuuid}
                    isFavorite={favoriteIds.has(s.stationuuid)}
                    onPlay={playStation}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            ) : query ? (
              <EmptyStations label={`No results for "${query}"`} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                <Headphones size={42} className="mb-3 opacity-30" />
                <p className="text-sm">Type a station name, genre or country above</p>
              </div>
            )}
          </div>
        )}

        {/* FAVORITES TAB */}
        {activeTab === 'favorites' && (
          <div className="space-y-4 duration-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Heart size={14} className="text-red-400" fill="currentColor" />
              <span className="text-sm text-zinc-400">Stations you've saved</span>
            </div>
            {favoriteStations.length === 0 ? (
              <EmptyStations label="No favorite stations yet — tap the heart on any station to save it" />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {favoriteStations.map((s) => (
                  <StationCard
                    key={s.stationuuid}
                    station={s}
                    isPlaying={playingId === s.stationuuid}
                    isReconnecting={isReconnecting && playingId === s.stationuuid}
                    isFavorite
                    onPlay={playStation}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

const LoadingGrid = () => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {Array.from({ length: 12 }).map((_, i) => (
      <div key={i} className="h-[78px] animate-pulse rounded-xl bg-white/5" />
    ))}
  </div>
);

const EmptyStations = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
    <Radio size={42} className="mb-3 opacity-20" />
    <p className="text-sm">{label}</p>
  </div>
);

export default RadioPage;
