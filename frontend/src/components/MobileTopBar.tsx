/**
 * MobileTopBar — a slim top bar shown only on mobile (hidden on md+).
 * Provides a left-positioned hamburger icon placeholder (the actual trigger
 * is the floating button in Sidebar.tsx) and a centred page title.
 *
 * Usage: render at the very top of any page's content area.
 */
import React from 'react';

interface MobileTopBarProps {
  title: string;
}

const MobileTopBar: React.FC<MobileTopBarProps> = ({ title }) => {
  return (
    <div className="mb-4 flex items-center pt-12 md:hidden">
      <h1 className="flex-1 text-center text-lg font-semibold">{title}</h1>
    </div>
  );
};

export default MobileTopBar;
