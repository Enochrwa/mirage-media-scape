import { getPlatform } from '../../platform'
import { WebTrayService } from './WebTrayService'
import { TauriTrayService } from './TauriTrayService'
import type { ITrayService } from './ITrayService'

let _instance: ITrayService | null = null

export function getTrayService(): ITrayService {
  if (_instance) return _instance
  _instance = getPlatform().host === 'desktop'
    ? new TauriTrayService()
    : new WebTrayService()
  return _instance
}
