import React from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/MainLayout';
import { useMedia, MediaFile } from '@/contexts/MediaContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Play, Music, Film, ListMusic, Upload } from 'lucide-react';

interface MediaCardProps {
  file: MediaFile;
}

const MediaCard: React.FC<MediaCardProps> = ({ file }) => {
  const { playFile } = useMedia();
  
  return (
    <Card className="group relative overflow-hidden">
      <div className="aspect-square">
        <img 
          src={file.cover || '/placeholder.svg'} 
          alt={file.title} 
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
        
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button 
            className="rounded-full bg-primary hover:bg-primary/90 w-12 h-12"
            onClick={() => playFile(file)}
          >
            <Play className="h-5 w-5 ml-0.5" />
          </Button>
        </div>
      </div>
      <div className="p-3">
        <p className="font-medium truncate">{file.title}</p>
        <p className="text-sm text-muted-foreground truncate">{file.artist || 'Unknown Artist'}</p>
      </div>
    </Card>
  );
};

const StatCard: React.FC<{ icon: JSX.Element; label: string; count: number; bg: string }> = ({ icon, label, count, bg }) => {
  return (
    <Card className={`${bg} hover:brightness-105 transition-all p-4 text-white flex flex-col`}>
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 bg-white/20 rounded-md">
          {icon}
        </div>
        <span className="text-2xl font-bold">{count}</span>
      </div>
      <p className="text-sm font-medium">{label}</p>
    </Card>
  );
};

const Home = () => {
  const { files, playlists } = useMedia();
  
  const audioFiles = files.filter(file => file.type === 'audio');
  const videoFiles = files.filter(file => file.type === 'video');
  
  const recentFiles = [...files].sort((a, b) => 0.5 - Math.random()).slice(0, 6);
  const featuredFiles = [...files].sort((a, b) => 0.5 - Math.random()).slice(0, 4);
  
  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-1">Welcome to Mirage</h1>
          <p className="text-muted-foreground">Your beautiful all-in-one media player</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            icon={<Music className="h-5 w-5" />} 
            label="Total Media" 
            count={files.length} 
            bg="bg-gradient-to-br from-emerald-500 to-lime-600" 
          />
        </div>
        
        {featuredFiles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Featured</h2>
              <Link to="/library">
                <Button variant="ghost" className="gap-1">
                  View Library <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredFiles.map(file => (
                <MediaCard key={file.id} file={file} />
              ))}
            </div>
          </div>
        )}
        
        {recentFiles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Recently Added</h2>
              <Link to="/library">
                <Button variant="ghost" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {recentFiles.map(file => (
                <MediaCard key={file.id} file={file} />
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-12 text-center p-8 rounded-lg bg-gradient-to-r from-purple-700/20 via-fuchsia-700/20 to-pink-700/20">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Upload Your Own Media</h2>
          <p className="text-muted-foreground mb-4">Add your music and videos to enjoy them in this beautiful player</p>
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
