import { useContext } from 'react';
import { PlatformContext } from './PlatformContext';
import type { PlatformCapabilities } from './capabilities';

/** Full capabilities object */
export function usePlatform(): PlatformCapabilities {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used inside <PlatformProvider>');
  return ctx;
}

/** Focused capability hook — prefer this for single checks */
export function useCapability<K extends keyof PlatformCapabilities>(
  key: K,
): PlatformCapabilities[K] {
  return usePlatform()[key];
}

/** Host identity shortcut */
export function useHost() {
  return usePlatform().host;
}
