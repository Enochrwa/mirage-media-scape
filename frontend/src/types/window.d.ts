import { PlaybackEngine } from '../lib/PlaybackEngine';

declare global {
  interface Window {
    playbackEngine: PlaybackEngine;
    API_BASE: string;
    webkitAudioContext: typeof AudioContext;
    DeviceOrientationEvent: {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
  }
}
