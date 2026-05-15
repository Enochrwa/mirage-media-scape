import type { INotificationService } from './INotificationService';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

export class TauriNotificationService implements INotificationService {
  async send(title: string, body: string): Promise<void> {
    const granted = await isPermissionGranted();
    if (granted) {
      sendNotification({ title, body });
    }
  }

  async requestPermission(): Promise<boolean> {
    const permission = await requestPermission();
    return permission === 'granted';
  }
}
