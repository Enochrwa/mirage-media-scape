import type { INotificationService } from './INotificationService'

export class WebNotificationService implements INotificationService {
  async send(title: string, body: string): Promise<void> {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
}
