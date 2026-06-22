import React from 'react';
import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  className?: string;
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ className, children }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar: hidden on mobile (≤md), shown on md+ */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3 pb-32 md:p-6 md:pb-28 lg:p-8 lg:pb-24">
          <div className={cn('mx-auto max-w-7xl', className)}>{children}</div>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
