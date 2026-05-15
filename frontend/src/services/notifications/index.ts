import { getPlatform } from '../../platform'
import { WebNotificationService } from './WebNotificationService'
import { TauriNotificationService } from './TauriNotificationService'
import type { INotificationService } from './INotificationService'

let _instance: INotificationService | null = null

export function getNotificationService(): INotificationService {
  if (_instance) return _instance
  _instance = getPlatform().host === 'desktop'
    ? new TauriNotificationService()
    : new WebNotificationService()
  return _instance
}
