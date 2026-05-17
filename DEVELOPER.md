# Zovyra – Developer Setup Guide

This document covers everything you need to go from a fresh clone to a running
development environment.  It explains the three issues that were fixed, what
was changed, and what you need to install on your machine.

---

## Architecture Quick Reference

```
zovyra/
├── frontend/          Vite + React PWA  (runs at :5173)
│   └── src-tauri/     Tauri shell for macOS/Windows/Linux desktop
├── server/            Express + Socket.io API  (runs at :3001)
├── native/            Rust/NAPI-RS addon  (.node binary, wraps FFmpeg)
├── android/           Android Capacitor project
├── ios/               iOS Capacitor project
└── scripts/           Developer tooling
```

The `native/` package compiles to a single `.node` binary that is loaded by
the server.  It wraps FFmpeg **statically** – end users never install FFmpeg.

---

## Prerequisites

### Always required (all platforms)
| Tool | Install |
|------|---------|
| Node.js ≥ 18 | https://nodejs.org |
| npm ≥ 9      | bundled with Node |

### Required only when building the native addon
| Platform | Command |
|----------|---------|
| macOS    | `xcode-select --install && brew install nasm` |
| Linux    | `apt-get install build-essential nasm yasm pkg-config` |
| Windows  | MSVC 2019 + `choco install nasm` or `winget install nasm` |
| All      | Rust: `curl https://sh.rustup.rs -sSf \| sh` |

> **You do NOT need to install FFmpeg system-wide.**  
> `ffmpeg-sys-next` downloads and compiles the correct FFmpeg version
> automatically inside Cargo's build cache when `FFMPEG_DOWNLOAD_BUILD=1`
> is set (see `native/.cargo/config.toml`).

---

## Getting Started

### 1. Install all dependencies
```bash
npm run install:all
```
This installs root, native, frontend, and server node_modules in one shot.
It also attempts to compile the native addon (Rust + FFmpeg from source).

### 2a. Start dev servers (server + frontend together)
```bash
npm run dev
```
Opens:
- Frontend (Vite HMR) → http://localhost:5173
- API server (tsx watch) → http://localhost:3001

### 2b. Or start them individually
```bash
npm run dev:server    # server only
npm run dev:frontend  # frontend only
```

### 3. Build native addon manually (if auto-build failed)
```bash
cd native
npm install
npm run build
# First run: ~5–10 minutes (downloads + compiles FFmpeg source)
# Subsequent runs: ~30 seconds (only Rust recompiles)
```

---

## What Was Fixed (and Why)

### Fix 1 – Native build: `avfft.h` not found

**Root cause:**  
`ffmpeg-sys-next` looked for FFmpeg headers in `/usr/include/libavcodec/` (the
system path).  On macOS, Homebrew puts them somewhere else; on a clean machine
they don't exist at all.

**Fix:**  
`native/Cargo.toml` – added the `build` feature to `ffmpeg-next`:
```toml
# Before
ffmpeg-next = "6.0.0"

# After
ffmpeg-next = { version = "6.1.0", features = ["build"] }
```

`native/.cargo/config.toml` – sets env vars that `ffmpeg-sys-next`'s
`build.rs` reads to download the FFmpeg source tarball and compile it
statically inside Cargo's cache:
```toml
[env]
FFMPEG_DOWNLOAD_BUILD = "1"
FFMPEG_STATIC         = "1"
FFMPEG_VERSION        = "6.1.1"
```

Result: `cargo build` fetches FFmpeg automatically.  No system install.
No `brew install ffmpeg`.  No `apt install libavcodec-dev`.

---

### Fix 2 – Server: `Must use import to load ES Module`

**Root cause:**  
`server/package.json` has `"type": "module"` (ESM), but `ts-node-dev`
internally uses the CJS loader which cannot handle ESM entry points.  It
throws before TypeScript even runs.

**Fix:**  
Replaced `ts-node-dev` with `tsx` in `server/package.json`:
```json
// Before
"dev": "ts-node-dev --respawn --transpile-only --exit-child src/index.ts"

// After  
"dev": "tsx watch src/index.ts"
```

`tsx` is an esbuild-powered TypeScript runner that natively supports ESM,
`"module": "NodeNext"`, and `import.meta.*`.  It provides the same hot-reload
behavior as `ts-node-dev` without the CJS/ESM conflict.

Also added `"ts-node": { "esm": true }` to `server/tsconfig.json` so other
tools (Jest, ts-node directly) also work in ESM mode.

---

### Fix 3 – Root `npm run dev` blocked by native build failure

**Root cause:**  
`predev` and `prebuild` hooks called `scripts/check-native.js`, which called
`process.exit(1)` if the native build failed – blocking the dev server from
starting even though the server works fine without the native binary.

**Fix:**  
- Removed `predev`/`prebuild` hooks from root `package.json` (only
  `postinstall` remains, so the auto-build attempt happens after `npm install`).
- Changed all `process.exit(1)` calls in `check-native.js` to `return`
  (non-fatal warnings) so a failed native build prints a helpful message
  but lets `npm run dev` continue.
- The server's `native-loader.ts` now detects whether a `.node` binary exists
  and falls back to `native/stub-build.js` automatically.
- Added `npm run build:no-native` as a shortcut for CI/web-only builds.

---

## Stub Mode vs Native Mode

| Mode | When active | Features |
|------|-------------|----------|
| **Stub** | No `.node` binary in `native/` | Server boots, API works, file scanning works; metadata extraction, waveforms, audio analysis, subtitles return empty/zero values |
| **Native** | After `cd native && npm run build` | Full FFmpeg: metadata, waveform generation, audio analysis (BPM/key/energy), subtitle extraction, thumbnail generation, ReplayGain |

The server logs which mode it is in at startup:
```
[zovyra-native] Running in STUB mode – native features are disabled.
  → Run cd native && npm run build to enable full support.
```

---

## Building for Production / Distribution

### Web (PWA)
```bash
npm run build:server && npm run build:frontend
```
No native binary needed for the web version.

### Desktop (Tauri – macOS/Windows/Linux)
```bash
npm run build:native          # compile FFmpeg + Rust addon
cd frontend && npx tauri build # packages the .node binary inside the app
```
The bundled `.node` file means **end users never install FFmpeg or Rust**.

### Mobile (iOS / Android)
FFmpeg is handled separately via native SDKs in the `ios/` and `android/`
directories.  The `native/` NAPI-RS addon is not used for mobile targets.

---

## Common Issues

### `cargo: command not found`
Install Rust: `curl https://sh.rustup.rs -sSf | sh && source ~/.cargo/env`

### macOS: `nasm: command not found` during native build
```bash
brew install nasm
```

### Linux: `linker cc not found`
```bash
apt-get install build-essential
```

### Native built but server still says stub mode
The binary filename must match your platform.  Check:
```bash
ls native/*.node
# Expected: zovyra-native.darwin-arm64.node  (Apple Silicon)
#           zovyra-native.darwin-x64.node    (Intel Mac)
#           zovyra-native.linux-x64-gnu.node (Linux x64)
```

### Port conflict
```bash
# server default: 3001
PORT=3002 npm run dev:server

# frontend default: 5173 (Vite picks next free port automatically)
```