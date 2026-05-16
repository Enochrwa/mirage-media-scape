import React from 'react';
import { usePlatform } from './usePlatform';
import type { PlatformCapabilities } from './capabilities';

interface PlatformFeatureProps {
  requires: keyof PlatformCapabilities;
  fallback?: React.ReactNode;
  children: React.ReactNode;

  // Explicit branches for the fallback hierarchy
  desktop?: React.ReactNode;
  mobile?: React.ReactNode;
  chrome?: React.ReactNode;
}

/**
 * Renders children based on a capability and a host-specific fallback hierarchy.
 */
export function PlatformFeature({
  requires,
  fallback = null,
  children,
  desktop,
  mobile,
  chrome,
}: PlatformFeatureProps) {
  const capabilities = usePlatform();

  if (requires === 'canAccessLocalFiles') {
    // 1. Desktop (Tauri)
    if (capabilities.host === 'desktop' && capabilities.canAccessLocalFiles) {
      return <>{desktop || children}</>;
    }

    // 2. Mobile (Capacitor Filesystem)
    if (capabilities.host === 'mobile') {
      return <>{mobile || children}</>;
    }

    // 3. Chrome (File System Access API)
    if (capabilities.host === 'web' && capabilities.supportsFileSystemAccessAPI) {
      return <>{chrome || children}</>;
    }

    // 4. Manual path input (fallback)
    return <>{fallback}</>;
  }

  return <>{capabilities[requires] ? children : fallback}</>;
}
