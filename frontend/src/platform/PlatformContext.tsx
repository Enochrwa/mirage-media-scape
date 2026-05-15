import React, { createContext, useContext } from 'react'
import type { PlatformCapabilities } from './capabilities'

const PlatformContext = createContext<PlatformCapabilities | null>(null)

/**
 * Wrap the app root with this provider AFTER awaiting initPlatform().
 * Pass the resolved capabilities as the value prop.
 */
export function PlatformProvider({
  value,
  children,
}: {
  value: PlatformCapabilities
  children: React.ReactNode
}) {
  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  )
}

/** Full capabilities object */
export function usePlatform(): PlatformCapabilities {
  const ctx = useContext(PlatformContext)
  if (!ctx) throw new Error('usePlatform must be used inside <PlatformProvider>')
  return ctx
}

/** Focused capability hook — prefer this for single checks */
export function useCapability<K extends keyof PlatformCapabilities>(
  key: K
): PlatformCapabilities[K] {
  return usePlatform()[key]
}

/** Host identity shortcut */
export function useHost() {
  return usePlatform().host
}
