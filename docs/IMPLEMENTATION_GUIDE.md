# Sonic Media Player - Next Phase Implementation Guide

This document provides a technical roadmap and implementation details for the next set of features to make Sonic the best and fastest media player in the world.

## 1. Audio Quality & UX (Sprint 2)

### 1.1 Parametric EQ
*   **Goal:** A 5-band EQ with a visual response curve.
*   **Implementation:**
    *   **Engine:** Use `BiquadFilterNode` in the Web Audio API. Create a chain of filters: LowShelf (80Hz), Peaking (250Hz), Peaking (1kHz), Peaking (4kHz), and HighShelf (12kHz).
    *   **UI:** A canvas-based frequency response visualizer. Use `getFrequencyResponse` on each filter node to calculate the combined gain at various frequencies and plot it.
    *   **Code:** See `src/lib/PlaybackEngine.ts` for the `ParametricEQ` class implementation.

### 1.2 Waveform Seek Bar
*   **Goal:** Replace the flat seek bar with a high-fidelity waveform.
*   **Implementation:**
    *   **Native:** Update `native/src/lib.rs` to decode audio using `ffmpeg-next` and extract peaks. Downsample to ~1000 data points.
    *   **API:** Expose an endpoint `/api/tracks/:id/waveform` that returns the peak array.
    *   **Frontend:** Render the array on a `<canvas>` inside the progress slider. Color-code the "played" vs "unplayed" parts.

### 1.3 Gapless Playback & Crossfade
*   **Goal:** Seamless transitions between tracks.
*   **Implementation:**
    *   **Gapless:** Use the `PlaybackEngine`'s `scheduleNext` method. Pre-decode the next track into an `AudioBuffer` and schedule it to start at `ctx.currentTime + currentBuffer.duration`.
    *   **Crossfade:** Use two `GainNode`s. As the current track approaches its end, ramp its gain to 0 while simultaneously ramping the next track's gain to 1 over a 1-12s period.

### 1.4 ReplayGain / R128
*   **Goal:** Consistent volume across the library so users don't have to adjust the knob between tracks.
*   **Implementation:**
    *   **Standard:** Use EBU R128 (Integrated Loudness) targeting -16 LUFS for web/mobile playback.
    *   **Analysis:** Update `native/src/lib.rs` to use a loudness normalization filter or manually calculate energy using the `realfft` crate. For a simpler approach, calculate the Root Mean Square (RMS) of samples and convert to dBFS.
    *   **Database:** Store the `loudness` value in the `tracks` table.
    *   **Playback:**
        ```typescript
        const targetLUFS = -16;
        const adjustment = targetLUFS - track.loudness;
        const gainMultiplier = Math.pow(10, adjustment / 20);
        gainNode.gain.setTargetAtTime(gainMultiplier, ctx.currentTime, 0.1);
        ```

### 1.5 Hardware Video Decode
*   **Goal:** 4K playback with < 10% CPU usage.
*   **Implementation:**
    *   **Web:** Use `hls.js` with `video` element which leverages `WebCodecs` or native browser hardware acceleration.
    *   **Desktop:** In Tauri, ensure `webkit2gtk` (Linux) or `WebView2` (Windows) has hardware acceleration enabled.

---

## 2. Intelligence & Discovery (Sprint 3)

### 2.1 BPM & Key Detection
*   **Goal:** Sort by energy and enable harmonic mixing.
*   **Implementation:**
    *   **Client-side:** Use `Essentia.js` (WASM) in a Web Worker to avoid blocking the UI thread.
    *   **Native:** Alternatively, use the `essentia-rust` bindings or similar DSP crates in the `native/` module for even faster server-side indexing.

### 2.2 Synced Lyrics
*   **Goal:** Immersive karaoke-style lyrics that scroll with the music.
*   **Implementation:**
    *   **Source:** Use `https://lrclib.net/api/get?artist_name=${artist}&track_name=${title}`.
    *   **Parsing:** Convert `[mm:ss.xx] Lyric text` into an array of `{ time: number, text: string }`.
    *   **UI:** Render lyrics in a scrollable container. Use `scrollIntoView({ behavior: 'smooth', block: 'center' })` for the active line.
    *   **Code:**
        ```typescript
        function parseLRC(lrc: string) {
          return lrc.split('\n').map(line => {
            const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
            if (!match) return null;
            return {
              time: parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 1000,
              text: match[4].trim()
            };
          }).filter(Boolean);
        }
        ```

### 2.3 AI Recommendations
*   **Goal:** "Addictive" discovery.
*   **Implementation:**
    *   **Feature Vectors:** Store audio features (BPM, Energy, Danceability, Spectral Centroid) in the database.
    *   **Similarity:** Use Cosine Similarity to find the K-nearest neighbors to the current track.
    *   **Engine:** Implement this logic in the Node.js service using `mathjs` or offload to a dedicated Python microservice if scaling.

---

## 3. Platform & Sync (Sprint 4)

### 3.1 Cross-Device Sync
*   **Goal:** Resume anywhere.
*   **Implementation:**
    *   **Backend:** Use Supabase (PostgreSQL + Realtime) to store user history and current playback state.
    *   **Privacy:** Implement client-side encryption (AES-GCM) so the server never sees the user's library metadata.

### 3.2 Spatial Audio
*   **Goal:** Immersive 3D sound.
*   **Implementation:**
    *   **Engine:** Use `PannerNode` with `panningModel = 'HRTF'`.
    *   **Head Tracking:** On mobile, use the `DeviceOrientationEvent` to update the `AudioListener`'s orientation in real-time.

### 3.3 Performance Monitoring (Low-Power Mode)
*   **Goal:** Fast on all hardware.
*   **Implementation:**
    *   Monitor FPS and battery level. If FPS drops below 30 or battery is < 20%, disable the visualizer and switch from Waveform Seek Bar to a simple Slider.
