import type { PlatformCapabilities } from '../capabilities';

export function detectWebCapabilities(): PlatformCapabilities {
  return {
    host: 'web',

    canAccessLocalFiles: false,
    canWatchFileSystem: false,
    canPickFolder: 'showDirectoryPicker' in window,

    canUseHardwareDecoding: false,
    canPlayHDR: window.matchMedia?.('(dynamic-range: high)').matches ?? false,
    supportsWebAudioAPI:
      typeof AudioContext !== 'undefined' ||
      typeof (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext !== 'undefined',
    canPlayDRM: 'requestMediaKeySystemAccess' in navigator,

    canControlMediaKeys: 'mediaSession' in navigator,
    canShowSystemTray: false,
    canShowLockScreen: false,
    canSendNativeNotifications: 'Notification' in window && Notification.permission === 'granted',

    canCacheOffline: 'indexedDB' in window,
    canSyncInBackground: 'serviceWorker' in navigator,

    supportsFileSystemAccessAPI: 'showDirectoryPicker' in window,
    supportsWebCodecs: 'VideoDecoder' in window,
    supportsMediaSourceExtensions: 'MediaSource' in window,

    canUseNativeContextMenu: false,
    supportsHapticFeedback: 'vibrate' in navigator,
  };
}
