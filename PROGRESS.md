# zovyra implementation progress

This file tracks delivery against the master specification. Status labels: **Done**, **Partial**, **Planned**.

## Canonical audio graph

- **Partial** — Full canonical block comment added at the audio graph construction site in `frontend/src/lib/PlaybackEngine.ts`. The live node chain still uses the previous simplified wiring (normalization → EQ → master → analyser → panner → compressor); Pre-Gain, dedicated ReplayGain vs crossfade split, Bass Enhancer (`WaveShaperNode`), and strict ordering will be aligned in a dedicated audio-engine pass.

## Step 0 — Instant media library

- **Partial**
  - **Done:** SQLite schema extended with `rating`, `play_count`, `file_type`, `waveform_data` on `tracks`; `auto_discovered` on `watched_folders`; additive migrations for existing DBs (`server/src/db/index.ts`).
  - **Done:** Fast `GET /api/tracks/instant` — latest 500 non-missing tracks, columns per spec (`server/src/controllers/tracksController.ts`, `server/src/routes/tracks.ts`).
  - **Done:** IndexedDB hydrates first; then instant API; full catalog fetch runs in background; `NEW_TRACKS` and `LIBRARY_CHANGE` socket handling (`frontend/src/store/useLibraryStore.ts`).
  - **Done:** Scan worker skips unchanged files using `(mtime, file_size)` (`server/src/services/scan-worker.ts`); persists `file_type` from native metadata.
  - **Done:** `chokidar`-based `LibraryWatcher` with 500ms debounced rescan; `unlink` / `unlinkDir` mark `missing = 1` (`server/src/services/LibraryWatcher.ts`); wired in `server/src/index.ts` and after scanner mutations (`server/src/controllers/scannerController.ts`).
  - **Done:** Library onboarding (home scan, manual path, skip) + `GET /api/scanner/bootstrap` (`frontend/src/components/LibraryOnboarding.tsx`, `server/src/controllers/scannerController.ts`, `server/src/routes/scanner.ts`, `frontend/src/components/MediaLibrary.tsx`).
  - **Done:** Virtualized `LibraryGrid` via `react-window` + `AutoSizer` (`frontend/src/components/LibraryGrid.tsx`).
  - **Done:** `GET /api/tracks/cover/:id` and `GET /api/tracks/thumbnail/:id` for file-based art (`server/src/controllers/tracksController.ts`, `server/src/routes/tracks.ts`).
  - **Planned / not in this pass:** Tauri-specific dialogs; recursive home scan safety UX; web-only File System Access + `music-metadata-browser` pipeline; waveform/Rust thumbnail generation in worker; `SCAN_PROGRESS` phase field; FTS sub-50ms verification at 100k scale.

## Steps 1–27

- **Planned** — Large surface (Media Session, tray, EQ UI completion, lyrics tiers, subtitles, WebCodecs path, radio modes, podcasts, downloads, sleep timer polish, recommendations, AI DJ, smart playlists, queue UI, stats recap, sync, remote, fingerprinting, duplicates, sharing, A/B loop UI, spatial head-tracking, PiP, accessibility pass, settings sections). Existing code in the repo already covers portions of several steps; this document will be updated incrementally as each step is completed.

### Files touched in this session

- `server/src/db/index.ts`
- `server/src/index.ts`
- `server/src/types/database.ts`
- `server/src/controllers/tracksController.ts`
- `server/src/controllers/scannerController.ts`
- `server/src/routes/tracks.ts`
- `server/src/routes/scanner.ts`
- `server/src/services/scanner.ts`
- `server/src/services/scan-worker.ts`
- `server/src/services/LibraryWatcher.ts` (new)
- `frontend/src/lib/PlaybackEngine.ts`
- `frontend/src/lib/utils.ts`
- `frontend/src/types/media.ts`
- `frontend/src/store/useLibraryStore.ts`
- `frontend/src/components/LibraryGrid.tsx`
- `frontend/src/components/LibraryOnboarding.tsx` (new)
- `frontend/src/components/MediaLibrary.tsx`
- `PROGRESS.md` (new)
