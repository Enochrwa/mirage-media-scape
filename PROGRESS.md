# zovyra implementation progress

This file tracks delivery against the master specification. Status labels: **Done**, **Partial**, **Planned**.

## Canonical audio graph

- **✅ Done** — Aligned `PlaybackEngine.ts` with the canonical audio graph spec: Source -> Pre-Gain -> EQ -> ReplayGain -> Crossfade -> Analyser -> Pitch Preserver -> Bass Enhancer -> Spatial Panner -> Night Compressor -> Master Volume -> Destination.

## Step 0 — Instant media library

- **✅ Done**
  - **Done:** SQLite schema extended with `rating`, `play_count`, `file_type`, `waveform_data` on `tracks`; `auto_discovered` on `watched_folders`; additive migrations for existing DBs (`server/src/db/index.ts`).
  - **Done:** Fast `GET /api/tracks/instant` — latest 500 non-missing tracks, columns per spec (`server/src/controllers/tracksController.ts`, `server/src/routes/tracks.ts`).
  - **Done:** IndexedDB hydrates first; then instant API; full catalog fetch runs in background; `NEW_TRACKS` and `LIBRARY_CHANGE` socket handling (`frontend/src/store/useLibraryStore.ts`).
  - **Done:** Scan worker handles native thumbnails and waveform peak generation.
  - **Done:** `chokidar`-based `LibraryWatcher` for real-time filesystem sync.
  - **Done:** Virtualized `LibraryGrid` for high-performance rendering.

## Step 1 — System Integration

- **✅ Done**
  - **Done:** Media Session API handlers registered in `usePlayerStore.ts`.
  - **Done:** Visibility listeners to pause RAF visualizers when app is backgrounded.
  - **Done:** Tauri System Tray implementation with playback controls and "minimize to tray".
  - **Done:** Global media key shortcuts registered via Tauri plugin.

## Step 2 — Player UI

- **✅ Done**
  - **Done:** Persistent `MiniPlayer` component with marquee scrolling for long titles.
  - **Done:** Full-screen `FullNowPlaying` view with dynamic blurred backgrounds, breathing animations, and 'More Like This' recommendations.

## Step 3 — Audio Engine

- **✅ Done**
  - **Done:** Canonical Audio Graph implemented in `PlaybackEngine.ts`.
  - **Done:** Bass Enhancer (harmonic exciter) and Night Mode (dynamic compressor).
  - **Done:** Parallel track chains for gapless crossfading.

## Step 4 — Audio Visualizer

- **✅ Done**
  - **Done:** 5 modes: Spectrum, Oscilloscope, Circular, Particles, Hybrid.
  - **Done:** High-performance GPU-accelerated canvas rendering.

## Step 6 — Synced Lyrics

- **✅ Done**
  - **Done:** 3-tier resolution: Embedded -> Cache -> LRCLIB API.
  - **Done:** LibreTranslate integration for lyrics translation.
  - **Done:** Word-level karaoke highlighting and binary-search optimized scrolling in `LyricsDisplay.tsx`.

## Step 7 — Subtitles

- **✅ Done**
  - **Done:** Native subtitle extraction and SRT/VTT/ASS parsing in `SubtitleService.ts`.
  - **Done:** External subtitle file loading support in `SubtitleManager.tsx`.

## Step 9 — Smart Radio

- **✅ Done**
  - **Done:** Internet Radio (Radio Browser API) with SQLite caching.

## Step 10 — Podcasts

- **✅ Done**
  - **Done:** RSS parsing with `fast-xml-parser` and episode progress tracking.

## Step 11 — Downloads

- **✅ Done**
  - **Done:** Background download manager with concurrency and progress persistence.

## Step 13 & 14 — AI Intelligence & DJ

- **✅ Done**
  - **Done:** Sophisticated `RecommendationService.ts` using content-based vectors and co-play signals.
  - **Done:** `AIDJService.ts` with script templates for contextual introductions.
  - **Done:** Enhanced Rust audio analysis with BPM, Key, Scale, Energy, and Danceability.

## Step 18 & 19 — Sync & Remote

- **✅ Done**
  - **Done:** WebSocket sync server for cross-device state updates.
  - **Done:** Remote control server for phone-as-remote functionality.

## Packaging

- **✅ Done**
  - **Done:** Tauri infrastructure initialized for desktop and mobile distribution.

### Files touched in this session

- `native/src/lib.rs`
- `native/Cargo.toml`
- `server/src/db/index.ts`
- `server/src/utils/db-utils.ts` (new)
- `server/src/services/scan-worker.ts`
- `server/src/services/SubtitleService.ts`
- `server/src/types/database.ts`
- `server/package.json`
- `frontend/src-tauri/src/lib.rs`
- `frontend/src-tauri/Cargo.toml`
- `frontend/src/lib/PlaybackEngine.ts`
- `frontend/src/components/player/MiniPlayer.tsx`
- `frontend/src/components/player/FullNowPlaying.tsx`
- `frontend/src/components/player/LyricsDisplay.tsx`
- `frontend/src/components/player/WaveformSeekBar.tsx`
- `frontend/src/components/SubtitleManager.tsx`
- `frontend/src/engines/VideoDecodeEngine.ts`
- `frontend/src/types/media.ts`
- `frontend/src/App.css`
- `PROGRESS.md`
