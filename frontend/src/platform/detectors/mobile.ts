import type { PlatformCapabilities } from '../capabilities';

export function detectMobileCapabilities(): PlatformCapabilities {
  return {
    host: 'mobile',

    canAccessLocalFiles: false, // requires explicit OS permission
    canWatchFileSystem: false,
    canPickFolder: true, // OS document picker

    canUseHardwareDecoding: true, // iOS/Android always hardware decode
    canPlayHDR: false,
    supportsWebAudioAPI: true,
    canPlayDRM: true,

    canControlMediaKeys: true, // AVAudioSession / ExoPlayer
    canShowSystemTray: false,
    canShowLockScreen: true, // lock screen now-playing
    canSendNativeNotifications: true,

    canCacheOffline: true,
    canSyncInBackground: true,

    supportsFileSystemAccessAPI: false,
    supportsWebCodecs: false,
    supportsMediaSourceExtensions: false,

    canUseNativeContextMenu: false,
    supportsHapticFeedback: true,
  };
}
