import type { PlatformCapabilities } from '../capabilities';

/**
 * Tauri desktop detector.
 *
 * window.__TAURI__ is injected by Tauri when the webview is running
 * inside the desktop app. It is absent in a normal browser.
 *
 * Hardware capabilities (codecs, HDR) come from a Rust probe invoked
 * asynchronously at startup. See src/platform/index.ts.
 */
export interface TauriProbeResult {
  hardware_codecs: { h264: boolean; hevc: boolean; av1: boolean; vp9: boolean };
  can_hdr: boolean;
  os_type: 'macos' | 'windows' | 'linux';
}

export function detectDesktopCapabilities(probe: TauriProbeResult): PlatformCapabilities {
  return {
    host: 'desktop',
    platform: 'web', // Desktop host identifies as web-platform in this simplified model

    canAccessLocalFiles: true,
    canWatchFileSystem: true, // @tauri-apps/plugin-fs watch
    canPickFolder: true, // @tauri-apps/plugin-dialog open()

    canUseHardwareDecoding: probe.hardware_codecs.h264,
    canPlayHDR: probe.can_hdr,
    supportsWebAudioAPI: true, // all OS webviews support it
    canPlayDRM: probe.os_type !== 'linux', // Widevine not on Linux WebKitGTK

    canControlMediaKeys: true, // MPRIS / MediaRemote / SMTC via Rust
    canShowSystemTray: true, // @tauri-apps/api/tray
    canShowLockScreen: false,
    canSendNativeNotifications: true, // @tauri-apps/plugin-notification

    canCacheOffline: true,
    canSyncInBackground: true, // Tauri background tasks

    supportsFileSystemAccessAPI: false, // not needed; has full native FS
    supportsWebCodecs: probe.os_type !== 'linux', // WebKitGTK lacks WebCodecs
    supportsMediaSourceExtensions: true,

    canUseNativeContextMenu: true, // Tauri menu API
    supportsHapticFeedback: false,
  };
}
