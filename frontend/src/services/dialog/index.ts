import { getPlatform } from '../../platform'
import { WebDialogService } from './WebDialogService'
import { TauriDialogService } from './TauriDialogService'
import type { IDialogService } from './IDialogService'

let _instance: IDialogService | null = null

export function getDialogService(): IDialogService {
  if (_instance) return _instance
  _instance = getPlatform().host === 'desktop'
    ? new TauriDialogService()
    : new WebDialogService()
  return _instance
}
