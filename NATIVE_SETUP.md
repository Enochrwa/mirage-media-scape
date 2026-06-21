# Zovyra — Desktop & Mobile Setup (Tauri + Capacitor)

Zovyra ships on five platforms from one React codebase:

| Platform        | Shell      | Location               |
|------------------|------------|-------------------------|
| Windows/macOS/Linux | Tauri 2 | `frontend/src-tauri/`  |
| Android          | Capacitor 8 | `android/`            |
| iOS              | Capacitor 8 | `ios/`                |

The `frontend/src/platform/` layer detects which shell it's running in at
startup and swaps in the right service implementations (file access, dialogs,
notifications, media keys, etc.) automatically — you don't need to branch on
platform in feature code.

---

## Prerequisites

| Tool | Needed for | Install |
|------|-----------|---------|
| Node.js ≥ 18 | Everything | [nodejs.org](https://nodejs.org) |
| Rust + Cargo | Desktop (Tauri) | [rustup.rs](https://rustup.rs) |
| Android Studio + SDK | Android | [developer.android.com/studio](https://developer.android.com/studio) |
| Xcode (macOS only) | iOS | Mac App Store |
| CocoaPods | iOS | `sudo gem install cocoapods` |

Run `npm run install:all` from the repo root first if you haven't already
(see `SETUP.md`).

---

## Desktop (Tauri)

### Dev mode

```bash
cd frontend
npm run tauri:dev
```

This starts the Vite dev server and opens a native window pointed at it, with
hot reload. First run compiles the Rust side (~1–2 min); subsequent runs are
fast.

### Production build

```bash
npm run build:desktop      # from repo root
```

Output (per OS) lands in `frontend/src-tauri/target/release/bundle/`:
- **Windows**: `.msi` and `.exe` (NSIS)
- **macOS**: `.app` and `.dmg`
- **Linux**: `.deb`, `.rpm`, and `.AppImage`

You can only build installers for the OS you're currently running on (e.g. you
need a Mac to produce a `.dmg`). Cross-compilation is possible but out of
scope here — see the [Tauri cross-platform CI docs](https://v2.tauri.app/distribute/)
if you need it.

### Config

- `frontend/src-tauri/tauri.conf.json` — window size, identifier, bundle targets, CSP.
- `frontend/src-tauri/capabilities/default.json` — which native APIs the webview may call.
- App identifier: `com.zovyra.app`. Change this **before** your first production
  release — it's permanent on most platforms once published (especially macOS
  notarization and Windows code-signing identities key off it).

---

## Mobile (Capacitor) — Android & iOS

### One-time: point the app at your dev server

A phone cannot resolve `localhost` to your computer. From the repo root:

```bash
npm run dev:mobile:android     # or dev:mobile:ios
```

This detects your machine's LAN IP, builds the frontend with the API base URL
set to `http://<your-lan-ip>:3001`, and runs `npx cap sync` with the dev server
URL set to `http://<your-lan-ip>:8080` — so the on-device app live-reloads
against your running Vite dev server instead of loading a static bundle.

**Before running it**, start these in separate terminals:

```bash
npm run dev:server      # Express API, port 3001
npm run dev:frontend    # Vite dev server, port 8080
```

Then:

```bash
npm run dev:mobile:android
# or
npm run dev:mobile:ios
```

Your phone and dev machine must be on the **same Wi-Fi network**. If the app
can't reach the server, double check:
- Your computer's firewall isn't blocking inbound connections on 3001/8080.
- `server/.env` → `CORS_ORIGINS` includes your LAN IP, e.g.
  `CORS_ORIGINS=http://192.168.1.50:8080,http://localhost:8080`.

### Android — running on a real device

1. Enable Developer Options + USB debugging on the phone.
2. Connect via USB (or set up wireless ADB).
3. From `frontend/`: `npx cap run android` — pick your device from the list.

Or open the project directly in Android Studio:

```bash
cd frontend && npx cap open android
```

### iOS — running on a real device (macOS + Xcode required)

1. Connect your iPhone via USB and trust the computer.
2. `cd frontend && npx cap open ios`
3. In Xcode: select your device, select your Apple Developer team under
   **Signing & Capabilities**, then hit Run.

First-time iOS builds also need CocoaPods installed (`pod install` runs
automatically via `cap sync`, but if it fails, run it manually inside `ios/App/`).

### Production builds

```bash
npm run build:android         # → android/app/build/outputs/.../app-release.apk (or .aab)
npm run build:android:debug   # unsigned debug build, for quick testing
npm run build:ios             # builds web assets + syncs; open Xcode to archive
```

**Android signing**: you'll need a release keystore before `assembleRelease`
produces a usable artifact. Generate one with `keytool` and configure it in
`android/app/build.gradle` (`signingConfigs`) — never commit the keystore file
itself (already gitignored).

**iOS signing/distribution**: handled entirely through Xcode/App Store
Connect — there's no CLI shortcut here, since Apple requires Xcode's archive
and notarization flow.

### Config

- `frontend/capacitor.config.ts` — app ID, native dirs, plugin config
  (splash screen, notification icon, media session).
- `android/app/src/main/AndroidManifest.xml` — permissions (media library
  access, foreground service for background audio, notifications).
- `ios/App/App/Info.plist` — usage strings (music/photo library), background
  audio mode.

Both manifest/plist files contain intentional, hand-tuned entries beyond
Capacitor's defaults — if you ever re-run `npx cap add` (which wipes the
platform folder), re-apply the permissions/usage-strings sections from git
history rather than accepting the bare defaults.

---

## Lock-screen / notification media controls

Implemented via `@capgo/capacitor-media-session` on mobile (the Android
WebView doesn't support the `navigator.mediaSession` Web API directly, so a
native plugin is required) and Tauri's tray + global-shortcut APIs on desktop.
Both are wired through the existing `IMediaKeyService` abstraction in
`frontend/src/services/mediaKeys/` — see `useMediaSession.ts` for the
integration point if you need to extend it (e.g. adding seek-by-offset
buttons).

---

## Architecture notes

- **Tauri does not depend on the `native/` Rust crate.** That crate is built
  for the Node.js NAPI addon (used by the Express server for audio analysis,
  fingerprinting, thumbnails, etc.) and isn't safe to link into a non-Node
  process — `napi-rs`'s generated code expects to resolve symbols against a
  live Node-API runtime. Tauri has its own small, independent hardware-codec
  probe in `frontend/src-tauri/src/hardware_codecs.rs`.
- **Capacitor plugins are pinned to major version 8** to match
  `@capacitor/core@8`. If you add a new plugin, check its README for Capacitor
  8 compatibility first — several popular plugins (e.g. the original
  `@capacitor-community/keep-awake`) only support Capacitor 7 and will warn
  during `cap add`/`cap sync` if mismatched.
