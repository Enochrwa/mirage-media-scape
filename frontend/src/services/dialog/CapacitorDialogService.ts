import { Dialog } from '@capacitor/dialog';
import type { IDialogService } from './IDialogService';

export class CapacitorDialogService implements IDialogService {
  async confirm(message: string, title?: string): Promise<boolean> {
    const result = await Dialog.confirm({
      title: title || 'Confirm',
      message,
    });
    return result.value;
  }

  async prompt(message: string, defaultValue?: string): Promise<string | null> {
    const result = await Dialog.prompt({
      title: 'Prompt',
      message,
      inputText: defaultValue || '',
    });
    return result.cancelled ? null : result.value;
  }
}
