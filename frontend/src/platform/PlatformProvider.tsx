import React from 'react';
import { PlatformContext } from './PlatformContext';
import type { PlatformCapabilities } from './capabilities';

/**
 * Wrap the app root with this provider AFTER awaiting initPlatform().
 * Pass the resolved capabilities as the value prop.
 */
export function PlatformProvider({
  value,
  children,
}: {
  value: PlatformCapabilities;
  children: React.ReactNode;
}) {
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}
