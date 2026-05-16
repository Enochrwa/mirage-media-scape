import { Capacitor } from '@capacitor/core';
import type { PlatformCapabilities } from '../capabilities';

export function detectMobileCapabilities(): PlatformCapabilities {
  const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
  return {
    host: 'mobile',
    platform,

    canAccessLocalFiles: false,
    canWatchFileSystem: false,
    canPickFolder: true,

    canUseHardwareDecoding: true,
    canPlayHDR: false,
    supportsWebAudioAPI: true,
    canPlayDRM: true,

    canControlMediaKeys: true,
    canShowSystemTray: false,
    canShowLockScreen: true,
    canSendNativeNotifications: true,

    canCacheOffline: true,
    canSyncInBackground: platform === 'android', // iOS background sync is heavily restricted

    supportsFileSystemAccessAPI: false,
    supportsWebCodecs: false,
    supportsMediaSourceExtensions: platform === 'android', // iOS WebKit has MSE limitations

    canUseNativeContextMenu: false,
    supportsHapticFeedback: true,
  };
}
