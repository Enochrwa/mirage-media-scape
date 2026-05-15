export interface INotificationService {
  send(title: string, body: string): Promise<void>;
  requestPermission(): Promise<boolean>;
}
