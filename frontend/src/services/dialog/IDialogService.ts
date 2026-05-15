export interface IDialogService {
  confirm(message: string, title?: string): Promise<boolean>
  prompt(message: string, defaultValue?: string): Promise<string | null>
}
