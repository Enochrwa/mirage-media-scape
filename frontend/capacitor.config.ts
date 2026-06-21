import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Zovyra — Capacitor configuration (Android + iOS)
 *
 * Dev mode:
 *   Set ZOVYRA_DEV_SERVER_URL to your machine's LAN IP (e.g. http://192.168.1.50:8080)
 *   and run `npx cap run android` / `npx cap run ios` so the device loads the live
 *   Vite dev server with hot reload instead of a bundled build.
 *
 *   Find your LAN IP:
 *     macOS/Linux: ifconfig | grep "inet "
 *     Windows:     ipconfig
 *
 *   Your phone and dev machine must be on the same Wi-Fi network.
 *
 * Production:
 *   Leave ZOVYRA_DEV_SERVER_URL unset. `server.url` becomes undefined and Capacitor
 *   loads the bundled `dist/` assets from the device — no network dependency.
 */
const devServerUrl = process.env.ZOVYRA_DEV_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.zovyra.app',
  appName: 'Zovyra',
  webDir: 'dist',

  // Only set during local dev (see comment above). Omitted entirely in production
  // builds so the app always loads its own bundled assets.
  ...(devServerUrl
    ? {
        server: {
          url: devServerUrl,
          cleartext: true, // allow http:// for LAN dev servers (no TLS on local Wi-Fi)
        },
      }
    : {}),

  android: {
    // Native shell lives at the monorepo root, as a sibling of frontend/, server/,
    // and native/ — not nested inside frontend/.
    path: '../android',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true, // chrome://inspect during dev; harmless in release too
  },

  ios: {
    path: '../ios',
    contentInset: 'automatic',
    scrollEnabled: true,
    webContentsDebuggingEnabled: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 400,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    MediaSession: {
      smallIcon: 'ic_notification',
    },
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#0f172a',
    },
  },
};

export default config;
