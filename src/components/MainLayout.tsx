
import React from 'react';
import Sidebar from '@/components/Sidebar';
import PlayerWrapper from '@/components/PlayerWrapper';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  className?: string;
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ className, children }) => {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className={cn("mx-auto max-w-7xl", className)}>
            {children}
          </div>
        </div>
        <PlayerWrapper />
      </main>
    </div>
  );
};

export default MainLayout;
