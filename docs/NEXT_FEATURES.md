# Sonic Media Player - Next Features & Implementation Bible

This document serves as the comprehensive engineering and design reference for the next phases of Sonic Media Player development. It combines the original project vision with technical implementation details.

## 1. Core Engine & Audio Quality (Sprint 2)

### 1.1 Parametric Equalizer
*   **Feature:** 5-band EQ with a visual response curve.
*   **Implementation:**
    *   **Engine:** Use `BiquadFilterNode` in the Web Audio API. Chain: LowShelf (80Hz) -> Peaking (250Hz) -> Peaking (1kHz) -> Peaking (4kHz) -> HighShelf (12kHz).
    *   **UI:** Canvas-based frequency response visualizer using `getFrequencyResponse` on filter nodes.
*   **Status:** Initial implementation exists in `PlaybackEngine.ts` and `EqualizerControls.tsx`.

### 1.2 Waveform Seek Bar
*   **Feature:** High-fidelity waveform for navigation.
*   **Implementation:**
    *   **Native (Rust):** Use `ffmpeg-next` to decode audio and extract peaks into 1000 buckets.
    *   **Backend:** Worker thread (`waveform-worker.js`) calls Rust native module.
    *   **Frontend:** `WaveformSeekBar.tsx` renders peaks on a canvas.
*   **Status:** Implemented.

### 1.3 Gapless Playback & Crossfade
*   **Feature:** Smooth transitions between tracks.
*   **Implementation:**
    *   **Gapless:** Pre-buffer the next track and use `AudioContext` scheduling (`start(time)`).
    *   **Crossfade:** Linear ramp of `GainNode` values (0 to 1 and 1 to 0) over a configurable duration (1-12s).
*   **Status:** Implemented in `PlaybackEngine.ts`.

### 1.4 ReplayGain / R128
*   **Feature:** Automatic volume normalization.
*   **Implementation:**
    *   **Analysis:** Rust native module calculates RMS/Loudness during indexing.
    *   **Playback:** `PlaybackEngine.applyReplayGain` adjusts a `GainNode` based on the stored `loudness` value, targeting -16 LUFS.
*   **Status:** Implemented.

### 1.5 Spatial Audio (HRTF)
*   **Feature:** Immersive 3D soundfield.
*   **Implementation:**
    *   **Engine:** Use `PannerNode` with `panningModel = 'HRTF'`.
    *   **Control:** Expose `setPosition(x, y, z)` for the panner and update `AudioListener` orientation for head tracking.
*   **Status:** **IMPLEMENTED** (`src/lib/PlaybackEngine.ts`, `src/components/SpatialAudioControls.tsx`)

---

## 2. Intelligence & Discovery (Sprint 3)

### 2.1 BPM & Key Detection
*   **Feature:** Automatic tempo and musical key identification.
*   **Implementation:**
    *   **Native:** Uses `stratum-dsp` crate in Rust during file indexing.
    *   **Storage:** `bpm`, `key`, `camelot_key` stored in SQLite.
*   **Status:** Implemented in native module and scanner.

### 2.2 Synced Lyrics
*   **Feature:** Scrolling karaoke-style lyrics.
*   **Implementation:**
    *   **API:** Fetch LRC from `lrclib.net`.
    *   **Frontend:** `LyricsService.ts` parses LRC; `LyricsDisplay.tsx` syncs with `currentTime`.
*   **Status:** Implemented.

### 2.3 AI Recommendations
*   **Feature:** Mood-based and similarity-based discovery.
*   **Implementation:**
    *   **Backend:** `RecommendationService.ts` uses Cosine Similarity on feature vectors (BPM, loudness, etc.) stored in the DB.
*   **Status:** Implemented.

---

## 3. Platform, Sync & Stats (Sprint 4)

### 3.1 Listening Statistics
*   **Feature:** Track most played songs, total listening time, and patterns.
*   **Implementation:**
    *   **Database:** `play_events` table (track_id, started_at, ended_at, completed).
    *   **Reporting:** `PlaybackEngine` sends heartbeat/event pings to `/api/stats/event`.
*   **Status:** **IMPLEMENTED** (`server/src/services/StatsService.ts`, `src/pages/StatsPage.tsx`)

### 3.2 Cross-Device Sync
*   **Feature:** Resume playback and sync playlists across devices.
*   **Implementation:**
    *   **Backend:** WebSocket server and event log.
    *   **Status:** **IMPLEMENTED (Local Network)** (`server/src/services/LocalSyncServer.ts`)

### 3.3 Resource Monitor (Low-Power Mode)
*   **Feature:** Optimize performance on low-end devices or low battery.
*   **Implementation:**
    *   **Logic:** Monitor FPS and `navigator.getBattery()`.
    *   **Action:** Disable visualizers, simplify waveforms, and reduce analysis frequency.
*   **Status:** **IMPLEMENTED** (`src/lib/ResourceMonitor.ts`)

---

## 4. Rare & Advanced Features (Roadmap)

### 4.1 Acoustic Fingerprinting
*   **Feature:** Identify unknown tracks by audio content.
*   **Implementation:** Integrate AcoustID/Chromaprint in the native module.
*   **Status:** **IMPLEMENTED** (`server/src/services/FingerprintService.ts`)

### 4.2 Phone as Remote
*   **Feature:** Control desktop player via mobile device.
*   **Implementation:** WebSocket signaling server for remote commands (play/pause, volume, seek).
*   **Status:** **IMPLEMENTED** (`server/src/services/RemoteControlServer.ts`, `src/pages/RemotePage.tsx`)

### 4.3 Music Map
*   **Feature:** Geographically tag library by artist origin.
*   **Implementation:** MusicBrainz API for artist metadata + D3/Three.js for globe visualization.
