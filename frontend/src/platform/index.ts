import type { PlatformCapabilities } from './capabilities';
import { detectWebCapabilities } from './detectors/web';
import { detectDesktopCapabilities, type TauriProbeResult } from './detectors/desktop';
import { detectMobileCapabilities } from './detectors/mobile';

function resolveHost(): 'web' | 'desktop' | 'mobile' {
  if (typeof window === 'undefined') return 'web';
  // Support Tauri v2 detection even when withGlobalTauri is false
  if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) return 'desktop';
  if (
    'Capacitor' in window &&
    (
      window as unknown as { Capacitor: { isNativePlatform?: () => boolean } }
    ).Capacitor?.isNativePlatform?.()
  )
    return 'mobile';
  return 'web';
}

let _cached: PlatformCapabilities | null = null;

/**
 * Synchronous getter — safe after initPlatform() has resolved.
 * Throws on desktop if called before initialization.
 */
export function getPlatform(): PlatformCapabilities {
  if (!_cached) {
    const host = resolveHost();
    if (host === 'web') {
      _cached = detectWebCapabilities();
      return _cached;
    }
    if (host === 'mobile') {
      _cached = detectMobileCapabilities();
      return _cached;
    }
    throw new Error('[Zovyra Platform] await initPlatform() before getPlatform() on desktop');
  }
  return _cached;
}

/**
 * Async initializer — must be awaited once at app startup before rendering.
 * Safe to call multiple times (no-op after first call).
 */
export async function initPlatform(): Promise<PlatformCapabilities> {
  if (_cached) return _cached;

  const host = resolveHost();

  if (host === 'desktop') {
    const { invoke } = await import('@tauri-apps/api/core');
    // probe_platform is best-effort: if the Rust command errors (e.g. FFmpeg
    // unavailable, IPC race during dev), fall back to a safe set of capabilities
    // so bootstrap() always reaches createRoot() and the window is never blank.
    let probe: TauriProbeResult;
    try {
      probe = await invoke<TauriProbeResult>('probe_platform');
    } catch (e) {
      console.warn('[Zovyra Platform] probe_platform failed — using safe fallback caps:', e);
      probe = {
        hardware_codecs: { h264: false, hevc: false, av1: false, vp9: false },
        can_hdr: false,
        os_type: 'macos', // safest default; no DRM restriction on macOS
      };
    }
    _cached = detectDesktopCapabilities(probe);
  } else if (host === 'mobile') {
    _cached = detectMobileCapabilities();
  } else {
    _cached = detectWebCapabilities();
  }

  if (import.meta.env.DEV) {
    console.info('[Zovyra Platform]', _cached);
  }

  return _cached;
}

export type { PlatformCapabilities };
export * from './PlatformContext';
export * from './PlatformProvider';
export * from './usePlatform';
export * from './PlatformFeature';
