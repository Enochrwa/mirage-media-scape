export interface IHapticsService {
  impact(style?: 'light' | 'medium' | 'heavy'): Promise<void>;
  vibrate(): Promise<void>;
  selection(): Promise<void>;
}
