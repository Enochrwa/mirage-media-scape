import { getPlatform } from '../../platform'
import { WebGlobalShortcutService } from './WebGlobalShortcutService'
import { TauriGlobalShortcutService } from './TauriGlobalShortcutService'
import type { IGlobalShortcutService } from './IGlobalShortcutService'

let _instance: IGlobalShortcutService | null = null

export function getGlobalShortcutService(): IGlobalShortcutService {
  if (_instance) return _instance
  _instance = getPlatform().host === 'desktop'
    ? new TauriGlobalShortcutService()
    : new WebGlobalShortcutService()
  return _instance
}
