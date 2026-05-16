/**
 * PlatformCapabilities — the single source of truth for what the
 * current host environment can do. The UI reads this. Nothing else.
 *
 * Inspired by Spotify's Platform API layer architecture.
 * See: https://engineering.atspotify.com/2021/04/building-the-future-of-our-desktop-apps
 */

export interface PlatformCapabilities {
  // Host identity
  host: 'web' | 'desktop' | 'mobile';

  // File system
  canAccessLocalFiles: boolean; // full FS access without picker
  canWatchFileSystem: boolean; // directory watching (Tauri fs plugin)
  canPickFolder: boolean; // folder picker (File System Access API or Tauri dialog)

  // Playback
  canUseHardwareDecoding: boolean; // VAAPI / VideoToolbox / D3D11VA
  canPlayHDR: boolean; // HDR video support
  supportsWebAudioAPI: boolean; // Web Audio API available
  canPlayDRM: boolean; // Widevine / FairPlay / PlayReady

  // OS integration
  canControlMediaKeys: boolean; // MPRIS / macOS Now Playing / Media Session API
  canShowSystemTray: boolean; // system tray mini-player
  canShowLockScreen: boolean; // lock screen now-playing (mobile)
  canSendNativeNotifications: boolean; // OS push notifications

  // Storage & offline
  canCacheOffline: boolean; // IndexedDB (web) or local FS (desktop/mobile)
  canSyncInBackground: boolean; // background sync when app is closed

  // Advanced web capabilities (progressive enhancement within web host)
  supportsFileSystemAccessAPI: boolean; // Chrome showDirectoryPicker
  supportsWebCodecs: boolean; // WebCodecs API (Chrome/Edge)
  supportsMediaSourceExtensions: boolean; // MSE for HLS adaptive streaming

  // UI
  canUseNativeContextMenu: boolean; // OS-native right-click menus
  supportsHapticFeedback: boolean; // vibration (mobile)
}
