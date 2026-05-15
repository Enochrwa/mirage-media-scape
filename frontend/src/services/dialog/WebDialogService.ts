import type { IDialogService } from './IDialogService'

export class WebDialogService implements IDialogService {
  async confirm(message: string, _title?: string): Promise<boolean> {
    return window.confirm(message)
  }

  async prompt(message: string, defaultValue?: string): Promise<string | null> {
    return window.prompt(message, defaultValue)
  }
}
