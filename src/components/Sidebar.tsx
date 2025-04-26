
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useMedia } from '@/contexts/MediaContext';
import { Search, Music, Film, ListMusic, Upload, Settings, Home, ChevronLeft, ChevronRight } from 'lucide-react';

type SidebarItemProps = {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active, onClick }) => {
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start gap-3 px-3 font-normal",
        active ? "bg-accent text-accent-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
      onClick={onClick}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
};

type SidebarProps = {
  className?: string;
};

export type SidebarView = 'home' | 'music' | 'videos' | 'playlists' | 'upload' | 'settings';

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const [view, setView] = useState<SidebarView>('home');
  const [collapsed, setCollapsed] = useState(false);
  const { playlists } = useMedia();
  
  return (
    <div className={cn(
      "group relative flex flex-col h-screen bg-sidebar transition-all duration-300 ease-in-out",
      collapsed ? "w-[60px]" : "w-[240px]",
      className
    )}>
      <div className="flex items-center justify-between p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Mirage</h2>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className="ml-auto" 
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </Button>
      </div>
      
      <div className={cn(
        "flex-1 overflow-y-auto scrollbar-hide px-2 py-4",
        collapsed && "items-center"
      )}>
        <div className="mb-4">
          <SidebarItem 
            icon={<Home size={20} />} 
            label="Home" 
            active={view === 'home'} 
            onClick={() => setView('home')} 
          />
          <SidebarItem 
            icon={<Search size={20} />} 
            label="Search" 
            onClick={() => {}} 
          />
        </div>
        
        <Separator className="my-4 bg-sidebar-border" />
        
        <div className="space-y-1">
          <SidebarItem 
            icon={<Music size={20} />} 
            label="Music" 
            active={view === 'music'} 
            onClick={() => setView('music')} 
          />
          <SidebarItem 
            icon={<Film size={20} />} 
            label="Videos" 
            active={view === 'videos'} 
            onClick={() => setView('videos')} 
          />
          <SidebarItem 
            icon={<ListMusic size={20} />} 
            label="Playlists" 
            active={view === 'playlists'} 
            onClick={() => setView('playlists')} 
          />
          <SidebarItem 
            icon={<Upload size={20} />} 
            label="Upload" 
            active={view === 'upload'} 
            onClick={() => setView('upload')} 
          />
        </div>
        
        {!collapsed && (
          <>
            <Separator className="my-4 bg-sidebar-border" />
            
            <div className="mb-2">
              <p className="px-4 text-xs text-sidebar-foreground/60 font-medium mb-1">YOUR PLAYLISTS</p>
              <div className="space-y-1">
                {playlists.map(playlist => (
                  <Button 
                    key={playlist.id} 
                    variant="ghost" 
                    className="w-full justify-start px-3 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    {playlist.name}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      
      <div className="p-2">
        <SidebarItem 
          icon={<Settings size={20} />} 
          label="Settings" 
          active={view === 'settings'} 
          onClick={() => setView('settings')} 
        />
      </div>
    </div>
  );
};

export default Sidebar;
