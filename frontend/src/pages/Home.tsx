import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/MainLayout';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { MediaFile } from '@/types/media';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowRight,
  Play,
  Music,
  Film,
  ListMusic,
  Upload,
  Clock,
  Heart,
  Bookmark,
  Share2,
  Shuffle,
  TrendingUp,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MoodDetector } from '@/components/MoodDetector';

interface MediaCardProps {
  file: MediaFile;
}

const MediaCard: React.FC<MediaCardProps> = ({ file }) => {
  const { playFile } = usePlayerStore();
  const { files, playlists } = useLibraryStore();

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg">
      <div className="aspect-square">
        <img
          src={file.cover || '/placeholder.svg'}
          alt={file.title}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />

        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
            onClick={() => playFile(file)}
          >
            <Play className="ml-0.5 h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="p-3">
        <p className="truncate font-medium">{file.title}</p>
        <p className="truncate text-sm text-muted-foreground">{file.artist || 'Unknown Artist'}</p>
      </div>
    </Card>
  );
};

const StatCard: React.FC<{ icon: JSX.Element; label: string; count: number; bg: string }> = ({
  icon,
  label,
  count,
  bg,
}) => {
  return (
    <Card
      className={`${bg} flex flex-col p-4 text-white transition-all duration-300 hover:scale-105 hover:brightness-105`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="rounded-md bg-white/20 p-2">{icon}</div>
        <span className="text-2xl font-bold">{count}</span>
      </div>
      <p className="text-sm font-medium">{label}</p>
    </Card>
  );
};

const Home = () => {
  const { files, playlists } = useLibraryStore();
  const [activeTab, setActiveTab] = useState('discover');

  const audioFiles = files.filter((file) => file.type === 'audio');
  const videoFiles = files.filter((file) => file.type === 'video');

  const recentFiles = [...files].sort((a, b) => 0.5 - Math.random()).slice(0, 6);
  const featuredFiles = [...files].sort((a, b) => 0.5 - Math.random()).slice(0, 4);
  const popularFiles = [...files].sort((a, b) => 0.5 - Math.random()).slice(0, 8);
  const recommendedFiles = [...files].sort((a, b) => 0.5 - Math.random()).slice(0, 4);

  return (
    <MainLayout>
      {/* Mobile top bar (hamburger already floated top-left by Sidebar) */}
      <div className="animate-fade-in space-y-6">
        <div className="pt-10 md:pt-0">
          <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-4xl">Welcome to Mirage</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Your beautiful all-in-one media player
          </p>
        </div>

        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold tracking-tight text-white">How are you feeling?</h2>
          <MoodDetector />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Music className="h-5 w-5" />}
            label="Audio Tracks"
            count={audioFiles.length}
            bg="bg-gradient-to-br from-purple-600 to-blue-500"
          />
          <StatCard
            icon={<Film className="h-5 w-5" />}
            label="Videos"
            count={videoFiles.length}
            bg="bg-gradient-to-br from-pink-600 to-orange-500"
          />
          <StatCard
            icon={<ListMusic className="h-5 w-5" />}
            label="Playlists"
            count={playlists.length}
            bg="bg-gradient-to-br from-cyan-500 to-blue-600"
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Recently Played"
            count={Math.min(4, files.length)}
            bg="bg-gradient-to-br from-emerald-500 to-lime-600"
          />
        </div>

        <Tabs defaultValue="discover" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="mb-6 grid grid-cols-4 md:w-[400px]">
            <TabsTrigger value="discover">Discover</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="recommended">For You</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-6">
            {featuredFiles.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                    <Bookmark className="h-5 w-5 text-primary" /> Featured
                  </h2>
                  <Link to="/library">
                    <Button variant="ghost" className="gap-1">
                      View Library <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {featuredFiles.map((file) => (
                    <MediaCard key={file.id} file={file} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="trending" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                  <TrendingUp className="h-5 w-5 text-pink-500" /> Popular Now
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {popularFiles.map((file) => (
                  <MediaCard key={file.id} file={file} />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recommended" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                  <Heart className="h-5 w-5 text-red-500" /> Recommended For You
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {recommendedFiles.map((file) => (
                  <MediaCard key={file.id} file={file} />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recent" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                  <Clock className="h-5 w-5 text-blue-500" /> Recently Added
                </h2>
                <Link to="/library">
                  <Button variant="ghost" className="gap-1">
                    View All <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                {recentFiles.map((file) => (
                  <MediaCard key={file.id} file={file} />
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-12 rounded-lg bg-gradient-to-r from-purple-700/20 via-fuchsia-700/20 to-pink-700/20 p-8 text-center">
          <h2 className="mb-2 text-2xl font-bold tracking-tight">Upload Your Own Media</h2>
          <p className="mb-4 text-muted-foreground">
            Add your music and videos to enjoy them in this beautiful player
          </p>
          <Link to="/upload">
            <Button className="gap-2">
              <Upload className="h-4 w-4" /> Upload Media
            </Button>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
};

export default Home;
