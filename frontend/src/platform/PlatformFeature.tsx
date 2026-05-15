import React from 'react'
import { usePlatform } from './PlatformContext'
import type { PlatformCapabilities } from './capabilities'

interface PlatformFeatureProps {
  requires: keyof PlatformCapabilities
  fallback?: React.ReactNode
  children: React.ReactNode
}

/**
 * Renders children only when the capability is available.
 * Renders fallback (or nothing) otherwise.
 *
 * Usage:
 *   <PlatformFeature requires="canShowSystemTray">
 *     <TrayIcon />
 *   </PlatformFeature>
 *
 *   <PlatformFeature requires="canAccessLocalFiles" fallback={<FolderPicker />}>
 *     <NativeFileBrowser />
 *   </PlatformFeature>
 */
export function PlatformFeature({ requires, fallback = null, children }: PlatformFeatureProps) {
  const capabilities = usePlatform()
  return <>{capabilities[requires] ? children : fallback}</>
}
