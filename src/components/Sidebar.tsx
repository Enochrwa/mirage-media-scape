
import React, { useState, useEffect } from 'react';
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuContent } from '@radix-ui/react-dropdown-menu';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMedia } from '@/contexts/MediaContext';
import { 
  Search, Music, Film, ListMusic, Upload, Settings, 
  Home, ChevronLeft, ChevronRight, Menu, Heart, Globe, 
  LayoutDashboard, Share2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

type SidebarItemProps = {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  to?: string;
  badge?: string | number;
};

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active, onClick, to, badge }) => {
  const content = (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start gap-3 px-3 font-normal relative",
        active ? "bg-accent text-accent-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
      onClick={onClick}
    >
      {icon}
      <span className="truncate">{label}</span>
      {badge && (
        <Badge variant="outline" className="ml-auto">
          {badge}
        </Badge>
      )}
    </Button>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }

  return content;
};

type SidebarProps = {
  className?: string;
};

export type SidebarView = 'home' | 'music' | 'videos' | 'playlists' | 'upload' | 'settings' | 'favorites' | 'dashboard';

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<SidebarView>('home');
  const [collapsed, setCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { playlists, files } = useMedia();
  
  useEffect(() => {
    // Set active view based on current route
    const path = location.pathname;
    if (path === '/') setView('home');
    else if (path === '/library' && files.filter(f => f.type === 'audio').length) setView('music');
    else if (path === '/library' && files.filter(f => f.type === 'video').length) setView('videos');
    else if (path === '/playlists') setView('playlists');
    else if (path === '/upload') setView('upload');
    else if (path === '/settings') setView('settings');
    else if (path === '/favorites') setView('favorites');
    else if (path === '/dashboard') setView('dashboard');
  }, [location.pathname, files]);

  const audioCount = files.filter(file => file.type === 'audio').length;
  const videoCount = files.filter(file => file.type === 'video').length;
  
  // Mobile menu
  const MobileMenu = () => (
    <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <Music className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight">Mirage</h2>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto px-2 py-4">
            {/* Same content as desktop sidebar */}
            <div className="mb-4">
              <SidebarItem
                icon={<Home size={20} />}
                label={t('Home')}
                active={view === 'home'}
                to="/"
              />
              <SidebarItem
                icon={<Search size={20} />}
                label={t('Search')}
                onClick={() => {}}
              />
              <SidebarItem
                icon={<LayoutDashboard size={20} />}
                label={t('Dashboard')}
                active={view === 'dashboard'}
                to="/dashboard"
              />
            </div>

            <Separator className="my-4 bg-sidebar-border" />

            <div className="space-y-1">
              <SidebarItem
                icon={<Music size={20} />}
                label={t('Music')}
                active={view === 'music'}
                to="/music"
                badge={audioCount}
              />
              <SidebarItem
                icon={<Film size={20} />}
                label={t('Videos')}
                active={view === 'videos'}
                to="/videos"
                badge={videoCount}
              />
              <SidebarItem
                icon={<ListMusic size={20} />}
                label={t('Playlists')}
                active={view === 'playlists'}
                to="/playlists"
                badge={playlists.length}
              />
              <SidebarItem
                icon={<Heart size={20} />}
                label={t('Favorites')}
                active={view === 'favorites'}
                to="/favorites"
              />
              <SidebarItem
                icon={<Upload size={20} />}
                label={t('Upload')}
                active={view === 'upload'}
                to="/upload"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 font-normal"
                  >
                    <Globe size={20} />
                    <span className="truncate">{t('Language')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>English</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => i18n.changeLanguage('es')}>Español</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Separator className="my-4 bg-sidebar-border" />

            <div className="mb-2">
              <p className="px-4 text-xs text-sidebar-foreground/60 font-medium mb-1">{t('YOUR PLAYLISTS')}</p>
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
          </div>

          <div className="p-2">
            <SidebarItem
              icon={<Settings size={20} />}
              label={t('Settings')}
              active={view === 'settings'}
              to="/settings"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
  
  return (
    <div className={cn(
      "group relative flex flex-col h-screen bg-sidebar transition-all duration-300 ease-in-out",
      collapsed ? "w-[60px]" : "w-[240px]",
      className
    )}>
      <div className="flex items-center justify-between p-4">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Mirage</h2>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
            <Music className="w-4 h-4 text-white" />
          </div>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn("ml-auto", collapsed && "mx-auto")} 
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
          <TooltipProvider>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <SidebarItem 
                      icon={<Home size={20} />} 
                      label="" 
                      active={view === 'home'} 
                      to="/" 
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Home
                </TooltipContent>
              </Tooltip>
            ) : (
              <SidebarItem
                icon={<Home size={20} />}
                label={t('Home')}
                active={view === 'home'}
                to="/"
              />
            )}
          </TooltipProvider>
          
          <TooltipProvider>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <SidebarItem
                      icon={<Search size={20} />}
                      label=""
                      onClick={() => {}}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t('Search')}
                </TooltipContent>
              </Tooltip>
            ) : (
              <SidebarItem
                icon={<Search size={20} />}
                label={t('Search')}
                onClick={() => {}}
              />
            )}
          </TooltipProvider>
          
          <TooltipProvider>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <SidebarItem
                      icon={<LayoutDashboard size={20} />}
                      label=""
                      active={view === 'dashboard'}
                      to="/dashboard"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t('Dashboard')}
                </TooltipContent>
              </Tooltip>
            ) : (
              <SidebarItem
                icon={<LayoutDashboard size={20} />}
                label={t('Dashboard')}
                active={view === 'dashboard'}
                to="/dashboard"
              />
            )}
          </TooltipProvider>
        </div>
        
        <Separator className="my-4 bg-sidebar-border" />
        
        <div className="space-y-1">
          <TooltipProvider>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <SidebarItem 
                      icon={<Music size={20} />} 
                      label="" 
                      active={view === 'music'}
                      to="/music"
                      badge={!collapsed ? audioCount : undefined}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Music ({audioCount})
                </TooltipContent>
              </Tooltip>
            ) : (
              <SidebarItem
                icon={<Music size={20} />}
                label={t('Music')}
                active={view === 'music'}
                to="/music"
                badge={audioCount}
              />
            )}
          </TooltipProvider>
          
          <TooltipProvider>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <SidebarItem
                      icon={<Film size={20} />}
                      label=""
                      active={view === 'videos'}
                      to="/videos"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t('Videos')} ({videoCount})
                </TooltipContent>
              </Tooltip>
            ) : (
              <SidebarItem
                icon={<Film size={20} />}
                label={t('Videos')}
                active={view === 'videos'}
                to="/videos"
                badge={videoCount}
              />
            )}
          </TooltipProvider>
          
          <TooltipProvider>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <SidebarItem 
                      icon={<ListMusic size={20} />} 
                      label="" 
                      active={view === 'playlists'} 
                      to="/playlists"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t('Playlists')} ({playlists.length})
                </TooltipContent>
              </Tooltip>
            ) : (
              <SidebarItem 
                icon={<ListMusic size={20} />} 
                label={t('Playlists')}
                active={view === 'playlists'} 
                to="/playlists"
                badge={playlists.length}
              />
            )}
          </TooltipProvider>
          
          <TooltipProvider>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <SidebarItem 
                      icon={<Heart size={20} />} 
                      label="" 
                      active={view === 'favorites'} 
                      to="/favorites"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t('Favorites')}
                </TooltipContent>
              </Tooltip>
            ) : (
              <SidebarItem 
                icon={<Heart size={20} />} 
                label={t('Favorites')}
                active={view === 'favorites'} 
                to="/favorites"
              />
            )}
          </TooltipProvider>
          
          <TooltipProvider>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <SidebarItem 
                      icon={<Upload size={20} />} 
                      label="" 
                      active={view === 'upload'} 
                      to="/upload"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t('Upload')}
                </TooltipContent>
              </Tooltip>
            ) : (
              <SidebarItem 
                icon={<Upload size={20} />} 
                label={t('Upload')}
                active={view === 'upload'} 
                to="/upload"
              />
            )}
          </TooltipProvider>
          
          <TooltipProvider>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-3 px-3 font-normal"
                        >
                          <Globe size={20} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>English</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => i18n.changeLanguage('es')}>Español</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t('Language')}
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 font-normal"
                  >
                    <Globe size={20} />
                    <span className="truncate">{t('Language')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>English</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => i18n.changeLanguage('es')}>Español</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TooltipProvider>
        </div>
        
        {!collapsed && (
          <>
            <Separator className="my-4 bg-sidebar-border" />
            
            <div className="mb-2">
              <p className="px-4 text-xs text-sidebar-foreground/60 font-medium mb-1">{t('YOUR PLAYLISTS')}</p>
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
        <TooltipProvider>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SidebarItem
                    icon={<Settings size={20} />}
                    label=""
                    active={view === 'settings'}
                    to="/settings"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                {t('Settings')}
              </TooltipContent>
            </Tooltip>
          ) : (
            <SidebarItem
              icon={<Settings size={20} />}
              label={t('Settings')}
              active={view === 'settings'}
              to="/settings"
            />
          )}
        </TooltipProvider>
      </div>
      
      {/* Mobile menu trigger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <MobileMenu />
      </div>
    </div>
  );
};

export default Sidebar;
