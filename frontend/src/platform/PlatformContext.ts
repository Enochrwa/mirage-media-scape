import { createContext } from 'react'
import type { PlatformCapabilities } from './capabilities'

export const PlatformContext = createContext<PlatformCapabilities | null>(null)
