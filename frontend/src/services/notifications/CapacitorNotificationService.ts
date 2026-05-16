import { LocalNotifications } from '@capacitor/local-notifications';
import type { INotificationService } from './INotificationService';

export class CapacitorNotificationService implements INotificationService {
  async requestPermission(): Promise<boolean> {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  }

  async send(title: string, body: string): Promise<void> {
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Math.floor(Math.random() * 1000000),
          schedule: { at: new Date(Date.now() + 100) }, // Schedule almost immediately
        },
      ],
    });
  }
}
