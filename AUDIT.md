# ZOVYRA Codebase Audit (Phase 0)

## Build Environment Blockers

The following system libraries are missing in the current sandbox environment, preventing `cargo check` or `cargo build` from completing in `frontend/src-tauri` and `native/`. These should be installed in the target deployment/development environment.

- **glib-2.0**: Required by `tauri` and its plugins.
  - *Install (Ubuntu/Debian):* `sudo apt-get install libglib2.0-dev`
- **gobject-2.0**: Required by `tauri` and its plugins.
  - *Install (Ubuntu/Debian):* `sudo apt-get install libglib2.0-dev` (part of the same package)
- **libavutil, libavcodec, libavformat, etc. (FFmpeg)**: Required by `zovyra-native` (via `ffmpeg-next`).
  - *Install (Ubuntu/Debian):* `sudo apt-get install libavcodec-dev libavformat-dev libavutil-dev libswresample-dev libswscale-dev`
- **pkg-config**: Required to locate the above libraries during build.
  - *Install (Ubuntu/Debian):* `sudo apt-get install pkg-config`

---

## Step 0.1 — Full File Inventory

### native/src/
- `lib.rs`: Rust media core.
  - `extract_metadata(path: String) -> Result<TrackMetadata, napi::Error>`
  - `generate_thumbnail(path: String, time_seconds: f64, output_path: String) -> Result<(), napi::Error>`
  - `get_subtitle_tracks(path: String) -> Result<Vec<SubtitleTrackInfo>, napi::Error>`
  - `extract_subtitle_stream(path: String, stream_index: u32) -> Result<String, napi::Error>`
  - `analyze_audio(path: String) -> Result<AudioMetadata, napi::Error>`
  - `generate_waveform(path: String) -> Result<Vec<f32>, napi::Error>`
  - `generate_waveform_fingerprint(path: String) -> Result<String, napi::Error>`
  - `generate_fingerprint(path: String) -> Result<FingerprintResult, napi::Error>`
  - `scan_folders(folders: Vec<String>) -> Vec<ScannedFile>`

### server/src/services/
- `AIDJService.ts`: AI DJ logic. Touches `tracks`, `artist_cache`.
- `DownloadManager.ts`: Manages downloads. Touches `downloads`.
- `DuplicateFinderService.ts`: Finds duplicate tracks. Touches `tracks`.
- `FingerprintService.ts`: AcoustID integration. Touches `fingerprint_cache`, `tracks`.
- `LibraryWatcher.ts`: Filesystem watcher. Touches `tracks`, `watched_folders`.
- `LocalSyncServer.ts`: Local network sync. Touches `sync_log`.
- `LyricsService.ts`: Fetches/caches lyrics. Touches `lyrics_cache`.
- `PodcastService.ts`: Podcast management. Touches `podcast_subscriptions`, `podcast_episodes`.
- `RadioService.ts`: Internet radio. Touches `radio_stations`, `radio_favorites`, `radio_history`.
- `RecommendationService.ts`: Recommendation engine. Touches `tracks`, `track_coplay`.
- `RemoteControlServer.ts`: WebSocket remote control.
- `SmartPlaylistService.ts`: Smart playlist evaluation. Touches `smart_playlists`, `tracks`.
- `StatsService.ts`: Aggregates stats. Touches `play_events`, `daily_stats`, `tracks`.
- `SubtitleService.ts`: Subtitle parsing.
- `scan-worker.ts`: Worker for scanning files.
- `scanner.ts`: Orchestrates scanning. Touches `tracks`, `watched_folders`.

### server/src/routes/
- `ai-dj.ts`: `/api/ai-dj/*`. Calls `AIDJService`.
- `podcasts.ts`: `/api/podcasts/*`. Calls `PodcastService`.
- `playlists.ts`: `/api/playlists/*`. Calls `playlistsController`.
- `radio.ts`: `/api/radio/*`. Calls `RadioService`.
- `scanner.ts`: `/api/scanner/*`. Calls `scannerController`, `scannerService`.
- `stats.ts`: `/api/stats/*`. Calls `StatsService`.
- `subtitles.ts`: `/api/subtitles/*`. Calls `SubtitleService`.
- `tracks.ts`: `/api/tracks/*`. Calls `tracksController`.

### types/ (Root level missing, currently in server/src/types/ and frontend/src/types/)
- `server/src/types/database.ts`: Database interfaces.
- `frontend/src/types/media.ts`: Frontend media types.

### src/engines/ (frontend/src/engines/)
- `ResourceMonitor.ts`: System resource monitoring.
- `SleepTimer.ts`: Playback sleep timer.
- `VideoDecodeEngine.ts`: Hardware decode probing and canvas rendering.

### src/components/ (frontend/src/components/)
- `AudioPlayer.tsx`, `VideoPlayer.tsx`: Media playback.
- `AudioVisualizer.tsx`: Visualizations.
- `LibraryGrid.tsx`: Grid of media.
- `MoodDetector.tsx`: Mood-based discovery.
- `SpatialAudioControls.tsx`: HRTF/Panner controls.
- `SubtitleManager.tsx`: Subtitle overlay/selection.
- `UploadMedia.tsx`: Media uploading UI.
- ... and others in `player/`, `tracks/`, `ui/`, `layout/`.

### src/pages/ (frontend/src/pages/)
- `Home.tsx`, `Library.tsx`, `Music.tsx`, `Videos.tsx`, `Playlists.tsx`, `PodcastsPage.tsx`, `RadioPage.tsx`, `StatsPage.tsx`, `DuplicateManagerPage.tsx`, `Settings.tsx`, `RemotePage.tsx`.

### src/hooks/ (frontend/src/hooks/)
- `useLowPowerMode.ts`: React hook for low power state.

### src/services/ (frontend/src/api/)
- `client.ts`: Centralized API client.

## Step 0.2 — Database Schema Audit

### Current Tables (server/src/db/index.ts):
- `tracks`: (id, title, artist, album, genre, year, duration, bitrate, sample_rate, channels, file_path, file_size, mtime, added_at, loudness, bpm, key, camelot_key, bpm_confidence, cover_cache_path, thumbnail_path, missing, metadata_json, rating, play_count, file_type, waveform_data, dominant_color)
- `watched_folders`: (path, added_at, auto_discovered)
- `playlists`: (id, name, created_at)
- `playlist_tracks`: (playlist_id, track_id, position)
- `smart_playlists`: (id, name, definition, created_at, updated_at)
- `play_events`: (id, track_id, started_at, ended_at, position, completed)
- `fingerprint_cache`: (fingerprint, result, fetched_at)
- `lyrics_cache`: (track_id, synced_lyrics, plain_lyrics, source, fetched_at)
- `settings`: (key, value)
- `radio_stations`: (stationuuid, name, url, url_resolved, country, countrycode, language, tags, bitrate, codec, favicon, cached_at)
- `podcast_subscriptions`: (id, title, feed_url, description, artwork_url, artwork_cache_path, author, website, language, explicit, subscribed_at, last_fetched, auto_download, play_count)
- `podcast_episodes`: (id, podcast_id, guid, title, description, audio_url, chapter_data, published_at, duration, played, progress_seconds, downloaded, download_path, file_size)
- `downloads`: (id, track_id, episode_id, url, local_path, status, progress, file_size, downloaded_bytes, created_at, wifi_only, priority, retries, error)
- `sync_log`: (id, type, payload, device_id, timestamp)
- `track_coplay`: (track_a, track_b, score)
- `tracks_fts`: (Virtual table)

### Gap List:
- `tracks`: Missing `album_artist`, `disc_number`, `track_number`, `energy`, `replay_gain_db`, `skip_count`, `updated_at`.
- `play_events`: Missing `seconds_played`, `skipped`, `source`, `device_id`.
- `daily_stats`: **Missing entirely**.
- `playlists`: Missing `description`, `updated_at`, `is_smart`.
- `playlist_tracks`: Missing `added_at`.
- `smart_playlists`: Missing `is_system`.
- `save_for_later`: **Missing entirely**.
- `downloads`: Missing `retry_count`. (Current has `retries`).
- `smart_download_rules`: **Missing entirely**.
- `podcast_subscriptions`: Missing (none major).
- `podcast_episodes`: Missing (none major).
- `radio_favorites`: **Missing entirely**.
- `radio_history`: **Missing entirely**.
- `eq_presets`: **Missing entirely**.
- `lyrics_translations`: **Missing entirely**.
- `artist_cache`: **Missing entirely**.
- `activity_feed`: **Missing entirely**.

## Step 0.3 — Rust Function Audit

### Current vs Requested:
- `extract_metadata`: Exists. Signature matches mostly. Needs to ensure it returns all requested fields (track_number, disc_number, etc.).
- `generate_thumbnail`: Exists.
- `analyze_audio`: Exists. Computes BPM, Key, Loudness, Energy, Danceability. Needs to ensure it matches the requested algorithm (spectral flux, chromagram, etc.).
- `generate_fingerprint`: Exists.
- `generate_waveform_fingerprint`: Exists. Returns hex string of 32 RMS values. Matches.
- `write_tags`: **Missing**.
- `get_subtitle_tracks`: Exists.
- `extract_subtitle_stream`: Exists.
- `probe_hardware_codecs`: Exists in `decoding.rs`.
- `compute_replay_gain`: **Missing**.

## Step 0.4 — Audio Graph Audit

### Current Chain (PlaybackEngine.ts):
Source (AudioBufferSourceNode) -> Chain (preGain -> EQ -> replayGain -> crossfade) -> Analyser -> [PitchPreserver] -> [BassEnhancer] -> [SpatialPanner] -> [Convolver] -> [NightCompressor -> NightMakeupGain] -> Master Volume -> Destination.

### Canonical Chain Delta:
Requested:
1. Source
2. EQ Chain
3. ReplayGain
4. Crossfade
5. Analyser
6. Spatial Panner
7. Compressor
8. Master Volume
9. Destination

Actual Delta:
- EQ/ReplayGain/Crossfade are currently per-track (parallel), which is correct for crossfading.
- Analyser is after Crossfade. (Correct)
- Spatial Panner is after Analyser. (Correct)
- Bass Enhancer and Convolver are present but NOT in the canonical chain spec. They should probably be removed or repositioned if allowed, but spec says "No node is added anywhere else."
- Compressor (Night) is after Spatial Panner. (Correct)
- Master Volume is last. (Correct)
- Missing: EQ Chain should be 5x BiquadFilterNode (already implemented as `ParametricEQ`).
- Missing: ReplayGain should be `10^(replayGainDb/20)`.

## Step 0.5 — Duplication Audit
- `LyricsService` exists in both `server/src/services/` and `frontend/src/lib/`.
- `ResourceMonitor.ts` exists in `frontend/src/engines/` and `frontend/src/lib/`.
- Type definitions for `Track` etc. are duplicated in `server/src/types/` and `frontend/src/types/`.

## Step 0.6 — Layer Violation Audit
- `tracksController.ts` uses `Worker` for waveform generation directly. This logic should be in a service.
- `scannerController.ts` calls `scannerService` which uses `worker_threads`.
- `LyricsService` in frontend might be doing network calls that should be proxied through backend.

## Step 0.7 — Feature Status Matrix

| Feature | Status | Layer Status | File Paths |
| :--- | :--- | :--- | :--- |
| Library Scanning | 🟡 Partial | Missing DB columns, Node service incomplete | `native/src/lib.rs`, `server/src/services/scanner.ts` |
| Metadata Extraction | 🟡 Partial | Missing fields in Rust & DB | `native/src/lib.rs`, `server/src/db/index.ts` |
| Video Thumbnail | ✅ Complete | Rust implementation exists | `native/src/lib.rs` |
| Audio Analysis | 🟡 Partial | Uses `stratum-dsp`, needs custom logic | `native/src/lib.rs` |
| Fingerprinting | ✅ Complete | AcoustID Rust implementation exists | `native/src/lib.rs` |
| Waveform Fingerprint | ✅ Complete | Rust implementation exists | `native/src/lib.rs` |
| Tag Writing | ❌ Missing | Not implemented in Rust | |
| Subtitle Extraction | ✅ Complete | Rust implementation exists | `native/src/lib.rs` |
| Hardware Probe | ✅ Complete | Implemented in `decoding.rs` | |
| ReplayGain Scan | ❌ Missing | Not implemented in Rust | |
| Playback Events | 🟡 Partial | DB missing columns, Service incomplete | `server/src/services/StatsService.ts` |
| Recommendations | 🟡 Partial | Service exists but needs logic update | `server/src/services/RecommendationService.ts` |
| Smart Playlists | 🟡 Partial | Service exists but needs SQL builder | `server/src/services/SmartPlaylistService.ts` |
| Download Manager | 🟡 Partial | Basic logic exists, needs Wifi/Auto-clean | `server/src/services/DownloadManager.ts` |
| Podcast Service | 🟡 Partial | Service exists, needs chapters/progress | `server/src/services/PodcastService.ts` |
| Radio Service | 🟡 Partial | Service exists, needs ICY proxy | `server/src/services/RadioService.ts` |
| Subtitle Service | 🟡 Partial | Parsers need implementation/hardening | `server/src/services/SubtitleService.ts` |
| AI DJ Service | 🟡 Partial | Templates and MusicBrainz bio needed | `server/src/services/AIDJService.ts` |
| Stats Service | 🟡 Partial | Recap and heatmap logic needed | `server/src/services/StatsService.ts` |
| Sync / Remote | 🟡 Partial | Basic implementation exists | `server/src/services/LocalSyncServer.ts` |
| Playback Engine | ✅ Complete | Refactored to use HTMLMediaElement and Platform API | `frontend/src/lib/PlaybackEngine.ts` |
| UI Components | 🟡 Partial | Most components exist but need logic audit | `frontend/src/components/` |

## Step 0.8 — Conflict and Risk List
- **Playback Source Conflict**: Existing `PlaybackEngine` is built around `AudioBufferSourceNode`. Switching to `HTMLMediaElement` is a major refactor that affects crossfading, EQ, and analysis. (RESOLVED in Platform Refactor)
- **Audio Analysis Algorithm**: The spec requires manual implementation of spectral flux and chromagram in Rust. Current implementation uses `stratum-dsp`.
- **Database Schema**: Existing schema in `server/src/db/index.ts` is missing many columns and tables required by the spec.
- **Type Duplication**: `Track` and other core types are defined in multiple places.
- **Native Dependencies**: Rust module depends on `ffmpeg-next`, `stratum-dsp`, `chromaprint`, `image`, `rayon`. Ensuring these match the spec's requirements for hardware probing and analysis is critical.
- **Worker Communication**: `PlaybackEngine` needs to handle `beforeunload` and `visibilitychange` to report events accurately.
