# ZOVYRA — Developer Blueprint: Complete Features & Implementation Reference

> A Media Operating System designed to surpass VLC, Spotify, Apple Music, and YouTube.
> Every feature listed here is **realistic, feasible**, and designed to keep all kinds of users addicted.
> Performance is a constraint, not an afterthought — every feature must work fast on Web (PWA), Desktop (Tauri), and Mobile (Capacitor).
>
> **How to use this document:** Each feature section contains a bullet-point specification (what it does from a user's perspective) followed by an **Implementation Notes** block that describes exactly what to build, which APIs or libraries to use, how data flows, and what edge cases must be handled. Any developer reading this document should be able to build the feature without needing to ask clarifying questions.

---

## Sprint Overview

| Sprint | Focus Area | Sections |
|--------|------------|----------|
| Sprint 1 | Playback Engine Foundation | §1 Playback Engine |
| Sprint 2 | Audio Processing & Analysis | §2 Audio Features |
| Sprint 3 | Video Playback | §3 Video Features |
| Sprint 4 | Library & Collection Management | §4 Library & Collection Management |
| Sprint 5 | Queue, Flow & Discovery | §5 Queue & Playback Flow · §6 Discovery & Recommendations |
| Sprint 6 | Playlists, Lyrics & Podcasts | §7 Smart Playlists & Automation · §8 Lyrics · §9 Podcasts |
| Sprint 7 | Radio, Downloads & Offline | §10 Radio · §11 Downloads & Offline |
| Sprint 8 | Stats, Sync & Remote Control | §12 Stats & Listening History · §13 Sync & Multi-Device · §14 Remote Control |
| Sprint 9 | AI DJ, Social & Interoperability | §15 AI DJ & Contextual Intelligence · §16 Social & Sharing · §17 Import & Export |
| Sprint 10 | Metadata, Accessibility & Personalization | §18 Metadata & Track Identification · §19 Accessibility · §20 Personalization & Themes |
| Sprint 11 | Performance & Platform-Specific | §21 Performance & Resource Awareness · §22 Desktop · §23 Mobile · §24 PWA |
| Sprint 12 | Security, Power Users & Onboarding | §25 Security & Privacy · §26 Power User & Pro Features · §27 Onboarding |

---

## Table of Contents

1. [Playback Engine](#1-playback-engine)
2. [Audio Features](#2-audio-features)
3. [Video Features](#3-video-features)
4. [Library & Collection Management](#4-library--collection-management)
5. [Queue & Playback Flow](#5-queue--playback-flow)
6. [Discovery & Recommendations](#6-discovery--recommendations)
7. [Smart Playlists & Automation](#7-smart-playlists--automation)
8. [Lyrics](#8-lyrics)
9. [Podcasts](#9-podcasts)
10. [Radio](#10-radio)
11. [Downloads & Offline](#11-downloads--offline)
12. [Stats & Listening History](#12-stats--listening-history)
13. [Sync & Multi-Device](#13-sync--multi-device)
14. [Remote Control](#14-remote-control)
15. [AI DJ & Contextual Intelligence](#15-ai-dj--contextual-intelligence)
16. [Social & Sharing](#16-social--sharing)
17. [Import & Export / Interoperability](#17-import--export--interoperability)
18. [Metadata & Track Identification](#18-metadata--track-identification)
19. [Accessibility](#19-accessibility)
20. [Personalization & Themes](#20-personalization--themes)
21. [Performance & Resource Awareness](#21-performance--resource-awareness)
22. [Desktop-Specific Features (Tauri)](#22-desktop-specific-features-tauri)
23. [Mobile-Specific Features (Capacitor)](#23-mobile-specific-features-capacitor)
24. [PWA / Web-Specific Features](#24-pwa--web-specific-features)
25. [Security & Privacy](#25-security--privacy)
26. [Power User & Pro Features](#26-power-user--pro-features)
27. [Onboarding & First-Run Experience](#27-onboarding--first-run-experience)

---

---

# 🏃 Sprint 1 — Playback Engine Foundation

> **Goal:** Get rock-solid core playback working across all formats, with precision controls and session continuity. Everything else in the product depends on this being right.

---

## 1. Playback Engine

These are the core engine features that underpin everything else. Getting these right is what separates a real media OS from a glorified file opener.

---

### 1.1 Universal Format Support

**What it does:**
- Plays every major audio format: MP3, FLAC, AAC, ALAC, OGG Vorbis, Opus, WAV, AIFF, WMA, M4A, APE, TrueAudio (TTA), WavPack, Musepack, ADPCM, DSD (DSF/DFF), AMR, and more.
- Plays every major video format: MP4, MKV, AVI, MOV, WMV, WebM, FLV, M2TS, TS, VOB, OGV, 3GP, RMVB, and more.
- Displays a clear "unsupported format" card (not a crash or blank screen) for files the engine cannot decode.
- Attempts playback of corrupt or truncated files and shows a warning badge if the file is partially damaged, rather than refusing to play entirely.

**Implementation Notes:**

The playback engine has two layers depending on platform:

- **Web / PWA:** Use the HTML5 `<audio>` and `<video>` elements routed through the Web Audio API for formats the browser natively supports (MP3, AAC, OGG, FLAC in modern browsers, WAV, WebM/Opus). For formats not supported natively (ALAC, APE, WMA, DSD, etc.), decode server-side via FFmpeg and stream the transcoded PCM audio as a chunked HTTP response to the browser. The frontend `PlaybackEngine` class should abstract this — it checks if the browser can play the format via `canPlayType()`, and if not, it requests a transcoded stream from `GET /api/stream/:trackId?format=pcm`.
- **Desktop (Tauri):** Use the Rust side to decode audio via a Rust FFmpeg binding (e.g., `ffmpeg-next` crate). The Rust layer exposes a NAPI-RS function `playFile(path)` that opens the file, decodes it, and feeds PCM chunks to a Rodio or CPAL audio output stream. The frontend communicates track commands (play, pause, seek) to the Rust layer via Tauri's `invoke()` IPC mechanism.
- **Format detection:** Do not rely on file extensions alone. Read the first 12 bytes of each file and match against known magic bytes (e.g., `fLaC` for FLAC, `ID3` for MP3, `OggS` for OGG). Store the detected codec in the SQLite `tracks` table as `codec TEXT`.
- **Unsupported format card:** When `canPlayType()` returns `''` and the server cannot transcode (unknown codec), render a centered card in the player area: file icon, filename, codec label, and a "Report Issue" link. Never navigate away or show an error modal.
- **Corrupt file resilience:** Wrap all decode calls in try/catch. If FFmpeg reports a decode error mid-stream, continue reading subsequent packets (FFmpeg's `av_read_frame` error recovery). Show a yellow warning badge on the progress bar: "⚠ File may be corrupted — some audio may be missing." Do not stop playback.

---

### 1.2 Gapless Playback

**What it does:**
- Plays consecutive tracks in a queue with zero audible silence between them.
- Works for all supported audio formats, not just AAC/ALAC.
- Allows per-track toggling of gapless behavior for live albums where intentional silence between tracks should be preserved.

**Implementation Notes:**

- **Pre-buffering:** When the current track reaches `duration - 3.0` seconds, begin decoding the next track in the queue into a secondary audio buffer. On Web, use the Web Audio API `AudioBufferSourceNode` — schedule the next source node to start at the exact `AudioContext.currentTime + remainingSeconds` of the current node. This achieves sample-accurate gapless scheduling.
- **Encoder delay / padding:** FLAC and MP3 encoders add silence at the start and end of files (encoder delay and padding samples). Read these values from the file's `iTunSMPB` atom (for AAC/ALAC), the FLAC `STREAMINFO` block, or the Xing/LAME header (for MP3). Trim exactly those many samples from the beginning and end of each decoded buffer before scheduling. Without this step, even "gapless" playback will have a perceptible click or pop at the join.
- **Per-track toggle:** Store `gapless_disabled BOOLEAN DEFAULT 0` on the `tracks` table. When this flag is set, insert a 50ms silent buffer between the previous track's end and this track's start — a subtle but effective way to restore the intended silence without breaking the queue flow.
- **Crossfade interaction:** Gapless and crossfade are mutually exclusive per-transition. If crossfade duration > 0, use the crossfade logic (§1.3) instead of zero-gap scheduling.

---

### 1.3 Crossfade

**What it does:**
- Fades out the current track while fading in the next track, with a user-configurable overlap of 0–12 seconds in 0.5-second increments.
- Per-playlist override allows a specific playlist or album to have its own crossfade duration, ignoring the global setting.
- Smart crossfade auto-disables for live album continuations (detected from track metadata).
- A settings preview lets users hear the crossfade effect on a sample pair before applying.

**Implementation Notes:**

- **Audio routing:** Route all playback through a `GainNode` chain: `SourceNodeA → GainNode_A → MasterGain → AudioContext.destination`. When crossfade begins, create `SourceNodeB → GainNode_B → MasterGain`. Ramp `GainNode_A.gain` from 1 to 0 using `linearRampToValueAtTime` over the crossfade duration. Simultaneously ramp `GainNode_B.gain` from 0 to 1 over the same duration. After the ramp completes, disconnect and discard `SourceNodeA`.
- **Crossfade trigger:** Start the crossfade when `currentTime >= duration - crossfadeDuration`. This requires knowing the track duration upfront (read from tags or decoded header at scan time).
- **Step control UI:** Render a range slider (`min=0`, `max=12`, `step=0.5`) in Settings → Playback. Show the value as `"X.X seconds"` alongside the slider. At `0`, display "Off" instead of "0.0 seconds."
- **Per-playlist override:** Add a `crossfade_duration_override REAL` column to the `playlists` table (NULL = use global). In the playlist detail view, show a collapsible "Playback Settings" section with the same slider. When a track from this playlist is playing, the engine reads the override first.
- **Smart crossfade detection:** At the moment of scheduling the next track, compare: `currentTrack.album === nextTrack.album AND currentTrack.disc_number === nextTrack.disc_number AND nextTrack.track_number === currentTrack.track_number + 1`. If all three match and the current track has `gapless_disabled = 0`, set the effective crossfade duration to 0 for this transition only. Log this override to the console in dev mode.
- **Preview:** In settings, embed a 10-second audio sample pair (ship two short royalty-free clips). When the user adjusts the slider, immediately apply the crossfade to those two clips using the same `GainNode` logic so they hear the exact effect.

---

### 1.4 ReplayGain / Volume Normalization

**What it does:**
- Normalizes playback volume so every track sounds approximately the same loudness, using either track-level or album-level ReplayGain values.
- Provides a pre-amp slider (±6dB) the user can apply on top of ReplayGain.
- Includes a hard limiter to prevent clipping when ReplayGain raises a quiet track's volume.
- A bulk scan operation computes and writes ReplayGain tags to an entire library in the background.

**Implementation Notes:**

- **ReplayGain tags:** Read `REPLAYGAIN_TRACK_GAIN`, `REPLAYGAIN_TRACK_PEAK`, `REPLAYGAIN_ALBUM_GAIN`, and `REPLAYGAIN_ALBUM_PEAK` from the file's tags (ID3v2 TXXX frames for MP3, VORBIS_COMMENT for FLAC/OGG, iTunes atoms for M4A). Store these four values in the `tracks` SQLite table as nullable REAL columns.
- **Applying gain:** In the Web Audio API graph, insert a `GainNode` (call it `replaygainNode`) between the source and the EQ chain. When loading a track, calculate the gain multiplier: `gainDB = (trackGain ?? albumGain ?? 0) + preampDB`. Convert to linear: `gainLinear = Math.pow(10, gainDB / 20)`. Set `replaygainNode.gain.value = gainLinear`.
- **Mode toggle:** In Settings → Playback, show a segmented control: "Off | Track | Album." Store the preference in the `settings` table as `replaygain_mode TEXT`.
- **Pre-amp slider:** Range: -6 to +6 dB, step 0.5. Default: 0. Show the current value in dB next to the slider. Apply this offset additively to the calculated `gainDB` above.
- **Clip prevention (hard limiter):** After the `replaygainNode`, insert a `DynamicsCompressorNode` configured as a hard limiter: `threshold = -0.1 dBFS`, `knee = 0`, `ratio = 20`, `attack = 0.001s`, `release = 0.1s`. This prevents the output from exceeding 0dBFS even when a large positive gain is applied.
- **Bulk scan:** Implement `POST /api/library/replaygain-scan` on the server. The endpoint reads each unscanned track's audio data, computes the integrated loudness using the ITU-R BS.1770-4 algorithm (implement in Rust for performance), derives the ReplayGain value relative to -18 LUFS, and writes the tags back to the file using the Rust tag writer. Run this as a background job with a worker thread — process one file at a time with `setImmediate` between files to avoid CPU spikes. Emit Socket.IO progress events: `{scanned: N, total: M}`. The frontend shows a progress bar in a dismissible toast.

---

### 1.5 Playback Speed & Pitch

**What it does:**
- Adjusts playback speed from 0.25× to 4.0× in 0.05× steps, controllable via slider and keyboard shortcuts.
- Changes speed without changing pitch (time-stretching), particularly useful for podcasts and audiobooks.
- Allows pitch-shifting independently of speed, in semitone steps (musician's mode).
- Remembers the last-used speed per podcast or audiobook item, so it auto-applies the next time that item plays.

**Implementation Notes:**

- **Speed without pitch change (time-stretching):** The HTML5 `<audio>` element's `playbackRate` property changes speed but also shifts pitch. For pitch-corrected speed change, use a phase vocoder approach. On desktop, use FFmpeg's `atempo` filter chained through the audio pipeline. On web, use the `SoundTouchJS` or `RubberBand.js` WASM library — feed decoded PCM chunks through it before sending to the `AudioBufferSourceNode`. The library handles time-stretching with pitch correction in real time.
- **Speed slider UI:** Show a horizontal slider labeled "Speed" with min=0.25, max=4.0, step=0.05. Display the current value as e.g. "1.50×". Add "−" and "+" buttons flanking the slider for 0.05× increments. Include a "Reset" button that returns to 1.0×.
- **Keyboard shortcuts:** `Shift+,` = decrease speed by 0.1×; `Shift+.` = increase speed by 0.1×. Show a transient HUD overlay with the current speed for 1 second after each keypress.
- **Pitch-only mode:** Implement a pitch-shift-only mode using the same WASM library's pitch-shifting feature (hold tempo constant, shift pitch). Present as a secondary control labeled "Pitch" in semitones, range -12 to +12. Only show this control in the expanded Now Playing view or in Settings → Playback for musicians.
- **Per-item speed memory:** Store `preferred_speed REAL` on the `tracks` table (and `podcasts_episodes` table). When a track finishes loading into the engine, read `preferred_speed` and apply it automatically. When the user manually changes speed during playback, write the new value back to the DB for that track. Do not apply speed memory to music tracks by default — only podcasts and audiobooks. Determine "audiobook" by checking the genre tag for "Audiobook" or "Spoken Word", or by the source (podcast feed).

---

### 1.6 A/B Loop

**What it does:**
- Lets users mark a start point (A) and end point (B) in a track. Playback loops between those two points.
- A and B markers appear as draggable handles on the waveform seek bar.
- A shaded region between A and B is visible on the seek bar.
- The user can set a loop count (loop N times then continue playing the rest of the track).
- The loop can be toggled on/off without clearing the A/B points.

**Implementation Notes:**

- **State:** Maintain `abLoop: { a: number | null, b: number | null, enabled: boolean, count: number, remaining: number }` in a React context or Zustand store accessible to the playback engine.
- **Setting A/B:** `[` key → sets `a = currentTime`. `]` key → sets `b = currentTime`. If A is set but B has not been set yet, show a pulsing "A" badge on the seek bar. Once both are set and `enabled = true`, activate the loop.
- **Loop enforcement:** In the playback engine's `timeupdate` handler (fires every ~250ms), check: `if (abLoop.enabled && abLoop.b !== null && currentTime >= abLoop.b)`. If the remaining loop count > 0: call `seek(abLoop.a)` and decrement `remaining`. If `remaining === 0`: disable the loop (but keep the A/B points) and continue normal playback.
- **Visual markers on seek bar:** Overlay two draggable triangular SVG handles on the waveform seek bar, positioned at `(a / duration) * barWidth` and `(b / duration) * barWidth`. Between them, render a semi-transparent colored rectangle. The user can drag each handle to adjust the points. On drag end, update `abLoop.a` or `abLoop.b` in the store.
- **Toggle key:** `\` (backslash) toggles `abLoop.enabled` without clearing A or B. Show a small "A/B" badge in the playback controls that is highlighted when the loop is active.
- **Loop count UI:** In the A/B loop panel (a small popover accessible from the "A/B" badge), show a number input labeled "Repeat N times." 0 = infinite loop. During looping, show a counter "Loop 2 of 5."
- **Persistence:** Store A, B, count, and enabled state in the `playback_state` table keyed by `track_id`. Restore when the track is loaded again in the same session.

---

### 1.7 Sleep Timer

**What it does:**
- Schedules automatic playback pause after a set duration (15, 30, 45, 60, 90 minutes, or "End of Track").
- Accepts a custom duration in minutes.
- Fades out audio gradually over the last 30 seconds before pausing.
- Shows a live countdown in the now-playing bar.
- Displays a moon icon in the mini-player when the timer is active.

**Implementation Notes:**

- **Timer state:** Maintain a `sleepTimer: { endsAt: number | null, mode: 'duration' | 'end_of_track' }` value in the global playback store. `endsAt` is a `Date.now()` timestamp in milliseconds.
- **Countdown display:** Use `setInterval` at 1-second resolution to compute `remaining = endsAt - Date.now()` and format as `MM:SS`. Render this as a small pill next to the volume control in the now-playing bar. When fewer than 60 seconds remain, pulse the pill with a subtle CSS animation to draw attention.
- **"End of Track" mode:** In this mode, set a flag `endOfTrack: true` instead of a timestamp. When the current track naturally ends, pause instead of advancing to the next track. The countdown display shows "Ends at track end" rather than a time.
- **Fade-out:** At `endsAt - 30000ms`, begin ramping `masterGain.gain` from its current value to 0 over 30 seconds using `linearRampToValueAtTime`. At `endsAt`, call `pause()` and reset `masterGain.gain.value = 1`. If the timer is cancelled during the fade, immediately ramp gain back to 1 over 0.5 seconds.
- **UI:** A moon icon button in the now-playing bar opens a bottom sheet (mobile) or popover (desktop). The sheet contains preset buttons (15m / 30m / 45m / 60m / 90m / End of Track) and a custom number input. Tapping a preset activates it immediately. While active, show a "Cancel" button. The moon icon glows amber when the timer is active.
- **Persistence:** Store `endsAt` in `sessionStorage` so the timer survives a page refresh during the same browser session but not across browser restarts.

---

### 1.8 Seek Precision

**What it does:**
- Click anywhere on the progress bar to jump to that position.
- Drag the playhead with a live timestamp tooltip showing the exact time at the drag position.
- Keyboard shortcuts for seeking: ←/→ = ±5s, Shift+←/→ = ±30s, Ctrl+←/→ = ±60s.
- Frame-by-frame advance for video when paused (`.` = advance one frame, `,` = go back one frame).
- Chapter-aware seeking: jump to next/previous chapter if the file contains chapter metadata.

**Implementation Notes:**

- **Click-to-seek:** The seek bar is a `<div>` with a `mousedown` listener. On `mousedown`, compute `seekRatio = event.offsetX / bar.clientWidth`, then call `seekTo(seekRatio * duration)`. On desktop, also bind `touchstart` for touch devices.
- **Drag-to-seek with tooltip:** On `mousedown` on the progress bar, set a `isDragging` flag. On `mousemove` (bound to `document` to prevent losing the drag if the cursor leaves the bar), update a tooltip absolutely positioned above the cursor showing the computed timestamp at that position (formatted `H:MM:SS` or `M:SS`). Only commit the seek on `mouseup`. During the drag, update the visual fill of the bar in real time but do not actually seek the audio (to avoid choppy scrubbing on slow hardware). On `mouseup`, seek once to the final position.
- **Keyboard seeking:** In the global keyboard handler, listen for `ArrowLeft`, `ArrowRight` with modifier keys. Guard against these firing when a text input is focused. Implement: `ArrowLeft` → `seekTo(currentTime - 5)`, `Shift+ArrowLeft` → `seekTo(currentTime - 30)`, `Ctrl+ArrowLeft` → `seekTo(currentTime - 60)`. Mirror for `ArrowRight`. Clamp result to `[0, duration]`.
- **Frame-by-frame (video only):** When video is paused, `.` calls `videoElement.currentTime += 1 / frameRate`. `,` calls `videoElement.currentTime -= 1 / frameRate`. Determine `frameRate` from the video's metadata (parse from the container) or default to 24fps. This requires the video element to be paused — if not paused, show a brief "Pause first" toast and ignore the keypress.
- **Chapter seek:** Store chapter data (label, startTime in seconds) in a `track_chapters` table with a foreign key to `tracks`. Populate this at scan time by parsing chapter atoms from MP4 (QuickTime `chpl` atom or `mp4chaps` tool) or MKV (using ffprobe JSON output with `-print_format json -show_chapters`). When chapters exist, show "Prev Chapter" (icon: `|◀`) and "Next Chapter" (`▶|`) buttons in the video control bar. Clicking them seeks to `chapters[currentChapterIndex - 1].startTime` or `chapters[currentChapterIndex + 1].startTime`. Determine `currentChapterIndex` by finding the last chapter whose `startTime <= currentTime`.

---

### 1.9 Queue Continuity

**What it does:**
- Playback position is remembered across app restarts, crashes, and device reboots.
- On relaunch, the app prompts the user: "Resume [Track Title] at 3:42?" with Accept and Dismiss options.
- Full playback history is preserved even after the user manually clears the queue.

**Implementation Notes:**

- **Persistence mechanism:** Every 5 seconds during playback, write a `playback_state` row to SQLite: `{track_id, position_seconds, queue_snapshot (JSON array of track IDs), queue_index, timestamp}`. Use `INSERT OR REPLACE` (upsert) on a single-row table keyed by a constant ID (e.g., `id = 1`). Storing the entire queue snapshot as a JSON array is sufficient for queues up to ~1000 items.
- **On app launch:** On startup, read `playback_state`. If a valid row exists and `timestamp` is within the last 7 days and `position_seconds > 5`, show the resume prompt as a bottom sheet (mobile) or a toast-style card (desktop) with: album art thumbnail, track title, formatted position ("at 3:42"), and two buttons "Resume" and "Dismiss." If the user taps Resume, reconstitute the queue from the stored track IDs, seek to `position_seconds`, and auto-play. If Dismiss, clear `playback_state` and start fresh.
- **Crash recovery:** Because the state is written every 5 seconds, a crash loses at most 5 seconds of position — acceptable. On next launch, the same resume flow triggers.
- **Queue clear vs. history:** The queue (what's up next) and the history (what was played) are stored separately. `playback_history` is an append-only log table: `{id, track_id, played_at, seconds_played, completed}`. Clearing the queue (`DELETE FROM queue_items`) does not touch `playback_history`. The History panel reads from `playback_history` in reverse chronological order.
- **Session boundary:** Start a new `session_id` (UUID) each time the app launches. All `playback_history` rows within a session share this ID. The History panel can group by session.

---

---

# 🏃 Sprint 2 — Audio Processing & Analysis

> **Goal:** Build out the full audio signal chain — EQ, spatial audio, compression, visualization — plus the per-track analysis metadata that feeds the recommendation engine.

---

## 2. Audio Features

---

### 2.1 Parametric Equalizer (5-Band)

**What it does:**
- Five frequency bands centered at 80Hz, 250Hz, 1kHz, 4kHz, and 12kHz, each with ±12dB gain adjustment via draggable faders and direct numeric input.
- A real-time frequency response curve is drawn on a canvas element below the faders, updating as any band changes.
- Fourteen built-in presets (Flat, Rock, Classical, Jazz, Bass Boost, Vocal, Electronic, Hip-Hop, Podcast, Gospel, Acoustic, Dance, R&B, Lo-Fi).
- Users can save, rename, and delete custom presets.
- Quick Bass Boost shortcut toggle.
- EQ bypass toggle for instant A/B comparison.

**Implementation Notes:**

- **Audio graph:** Insert five `BiquadFilterNode` instances in series between the source node and the gain/compressor nodes. Configure each: `type = 'peaking'`, `frequency` set to its center frequency (80, 250, 1000, 4000, 12000), `Q = 1.0` (reasonable bandwidth for music EQ). Control gain via `filter.gain.value` (range -12 to 12).
- **UI faders:** Render each band as a vertical range slider (`input[type=range]`, `min=-12`, `max=12`, `step=0.5`). Display the frequency label above and the dB value below. Use CSS to style sliders vertically (`writing-mode: vertical-lr` + `transform: rotate(180deg)`). On input, immediately update the corresponding `BiquadFilterNode.gain.value` (no debounce needed — Web Audio API handles this smoothly).
- **Frequency response curve:** Below the faders, render a `<canvas>` element (width: full panel width, height: 80px). On any band change, redraw the curve by sampling the combined frequency response: for each pixel X across the canvas, compute the corresponding frequency on a log scale (20Hz to 20kHz), then sum the gain contributions of all five peaking filters at that frequency using the formula for a second-order peaking EQ. Draw a path through these points. Color the curve in the app's accent color. Fill below the flat line with a semi-transparent tint.
- **Presets:** Store preset band values as a `{f80, f250, f1k, f4k, f12k}` object. Ship the 14 built-in presets hardcoded in the frontend. Store user custom presets in the `eq_presets` SQLite table: `{id, name, f80, f250, f1k, f4k, f12k, created_at}`. A preset dropdown above the faders shows "Custom" when the current values don't match any saved preset.
- **Bass Boost shortcut:** A dedicated `B` keyboard shortcut or a small toggle button applies/removes a preset `{f80: +6, f250: +2, f1k: 0, f4k: 0, f12k: 0}`. Toggle remembers the previous state and restores it on un-boost.
- **EQ bypass:** A toggle switch labeled "EQ" in the panel header sets all five filters' `gain.value` to 0 without changing the UI fader positions. Un-bypassing restores the saved values. This lets users instantly compare before/after.
- **Persistence:** On any fader change, debounce (300ms) and write the current values to `settings` table as a JSON blob key `eq_bands`. Read on app start and apply to the audio graph before any playback begins.

---

### 2.2 Audio Compressor / Night Mode

**What it does:**
- Three compression modes: Off (no processing), Standard (gentle dynamic leveling), and Night Mode (aggressive compression for late-night listening to prevent loud peaks from waking others).
- In an Advanced mode, exposes Threshold, Ratio, and Knee controls for power users.
- Bypass toggle for real-time A/B comparison.

**Implementation Notes:**

- **Audio node:** Use a single `DynamicsCompressorNode` inserted in the audio graph after the EQ chain. Configure its parameters based on the selected mode:
  - **Off:** Disconnect the compressor node from the graph (bypass it with a direct connection).
  - **Standard:** `threshold = -24 dBFS`, `knee = 30`, `ratio = 4`, `attack = 0.003s`, `release = 0.25s`. This gently reduces dynamic range without audible pumping.
  - **Night Mode:** `threshold = -12 dBFS`, `knee = 5`, `ratio = 20`, `attack = 0.001s`, `release = 0.1s`. This aggressively limits peaks, resulting in a more uniform loudness.
- **Advanced mode UI:** A "Show Advanced" link reveals three sliders: Threshold (-60 to 0 dBFS), Ratio (1 to 20), and Knee (0 to 40). Changing any advanced slider automatically sets the mode to "Custom."
- **Gain reduction meter:** Show a small vertical bargraph labeled "GR" (gain reduction) next to the mode buttons. Read `compressorNode.reduction` in a `requestAnimationFrame` loop and update the bargraph. This gives users feedback that the compressor is working.
- **Bypass:** A toggle button that directly connects source to destination, bypassing the compressor node. Labeled "Bypass" and highlighted in red when active.
- **Persistence:** Store `{mode, threshold, ratio, knee}` in the `settings` table.

---

### 2.3 Spatial Audio / 3D Audio

**What it does:**
- HRTF-based binaural spatial audio panning using the Web Audio API `PannerNode`. The sound source can be positioned in 3D space around the listener's head.
- A 2D drag pad UI lets users position the sound source on an X/Y plane.
- An elevation slider controls height (Y-axis in 3D space).
- Head tracking on mobile uses device gyroscope data to update listener orientation in real time.
- A bypass toggle disables spatial audio and returns to standard stereo.

**Implementation Notes:**

- **PannerNode setup:** Insert a `PannerNode` into the audio graph before the master gain. Set `panner.panningModel = 'HRTF'` and `panner.distanceModel = 'inverse'`. Set `AudioContext.listener` position to `(0, 0, 0)` facing `(0, 0, -1)` with up vector `(0, 1, 0)`. The panner source position controls where the sound appears to come from in 3D space around the listener.
- **2D drag pad UI:** Render a square canvas (e.g., 200×200px) with a circle at the center representing the listener. A draggable dot represents the sound source. As the user drags, map `(dragX, dragY)` to `(panner.positionX.value, panner.positionZ.value)` — X is left/right, Z is front/back. The canvas shows a top-down view. Use `panner.positionX.setValueAtTime(x, ctx.currentTime)` for smooth updates.
- **Elevation slider:** A vertical slider maps to `panner.positionY.value` (range -1 to 1). Positive Y = above, negative Y = below. Label it "Elevation" with icons (↑↓) at the extremes.
- **Head tracking (mobile):** Listen to `DeviceOrientationEvent` on mobile. Map `event.alpha` (compass heading), `event.beta` (front-back tilt), and `event.gamma` (left-right tilt) to the `AudioContext.listener` orientation via `listener.setOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ)`. Update listener orientation on every device orientation event. Include a permission request prompt (required on iOS 13+). Add a settings toggle "Use head tracking" (default off, battery-intensive).
- **Bypass toggle:** When bypassed, disconnect the `PannerNode` and patch the source directly to the next node. When un-bypassed, re-insert the `PannerNode`. Store bypass state and last known position in settings.
- **Stereo-to-binaural note:** For stereo sources, merge to mono before the `PannerNode` using a `ChannelMergerNode` configuration. True binaural spatial audio only works with mono sources — a stereo source run through HRTF will produce phase artifacts.

---

### 2.4 Audio Visualizer

**What it does:**
- Four visualization modes: Spectrum Bars (FFT frequency display), Oscilloscope (live waveform), Circular (radial frequency bars around album art), and Beat Particles (bass-reactive particle burst).
- All visualizers pause their render loop when the browser tab is hidden.
- Visualizers auto-pause in Low Power Mode.
- A background mode renders the visualizer behind the album art with reduced opacity.

**Implementation Notes:**

- **AnalyserNode:** Insert an `AnalyserNode` (tapped from the audio graph, not in-series) with `fftSize = 2048`. This gives 1024 frequency bins. Access frequency data via `analyser.getByteFrequencyData(dataArray)` and time-domain data via `analyser.getByteTimeDomainData(dataArray)`.
- **Render loop:** Use `requestAnimationFrame` for all visualizers. Store the RAF ID so it can be cancelled. On `visibilitychange` event (tab hidden), call `cancelAnimationFrame(rafId)`. On tab visible again, restart the RAF loop.
- **Spectrum Bars:** Map frequency bins to bar positions. Use the first 512 bins (covering ~0–11kHz). Color each bar by its frequency range: bass (0–250Hz) = red/orange, mids (250–4kHz) = green/yellow, highs (4k+) = blue/purple. Apply a logarithmic frequency scale so bass bars are wider and high-frequency bars are narrower. Smooth bar heights using a decay factor: `displayHeight[i] = max(freqData[i], displayHeight[i] * 0.85)`.
- **Oscilloscope:** Draw a polyline through the 2048 time-domain samples mapped to the canvas height (center = 128, range 0–255). Style: thin single-pixel line in the accent color on a dark background. Add a subtle glow effect using a second, blurred pass.
- **Circular:** Render the same FFT data as radial bars around a center point. Map each bar's height to its radius extension. Album art fills the inner circle. Rotate the entire visualization slowly over time (1 full rotation per 60 seconds) for visual interest.
- **Beat Particles:** Detect bass beats by monitoring the energy in bins 0–10 (sub-bass). If `currentEnergy > threshold * 1.3` (threshold = rolling average of last 30 frames), trigger a particle burst. Maintain a particle pool (max 200 particles). Each particle has position, velocity, color, and lifetime. Update particle physics in the RAF loop and draw as colored circles. Fade particles out as lifetime decreases. This creates a reactive "pop" effect on every kick drum or bass hit.
- **Background mode:** Render the visualizer on a `<canvas>` positioned absolutely behind the album art. Set canvas `opacity: 0.15` and apply a `blur(4px)` CSS filter for a subtle, non-distracting effect.
- **Low Power Mode hook:** Call `useLowPowerMode()` hook in the visualizer component. When low power mode is active, cancel the RAF loop and show a static placeholder.

---

### 2.5 Stereo Widening

**What it does:**
- Adjusts the stereo width of audio from 0% (mono) through 100% (natural stereo) up to 200% (hyper-wide).
- Shows a mono compatibility warning if the widened signal would cancel significantly in mono.

**Implementation Notes:**

- **Mid-Side processing:** Implement stereo widening via mid-side (M/S) processing in the Web Audio API. Create a `ChannelSplitterNode` (2 outputs: L and R). Compute Mid = (L + R) / 2 and Side = (L - R) / 2 using a `GainNode` and `ChannelMergerNode` combination. Apply a `GainNode` to the Side signal: `sideGain.gain.value = widthRatio` where `widthRatio = width / 100`. At 100%, `sideGain = 1.0` (natural). At 200%, `sideGain = 2.0` (doubled side content). At 0%, `sideGain = 0` (pure mono). Recombine: L_out = Mid + Side_widened, R_out = Mid - Side_widened.
- **Slider UI:** A horizontal slider labeled "Stereo Width" with labels "Mono (0%)", "Natural (100%)", "Wide (200%)" at the extremes and center. Show the current percentage value numerically.
- **Mono compatibility indicator:** After computing the widened signal, estimate mono compatibility: if `sideGain > 1.2`, show a warning icon 🔔 with tooltip "Wide settings may cause phase cancellation in mono. Safe for headphones, not for mono speakers." Do not block the user from setting it higher.
- **Performance note:** All of this processing happens in the Web Audio API's audio thread (off the main thread), so it has zero impact on UI performance. The M/S node graph is constructed once and parameters are updated via `.value`.

---

### 2.6 Audio Analysis Metadata (stored per track)

**What it does:**
- Automatically detects and stores BPM, musical key, Camelot wheel key code, energy score, and loudness for every track in the library.
- All values are editable manually in the track's metadata editor in case the algorithm is wrong.

**Implementation Notes:**

- **BPM detection:** Implement in a Rust worker (for performance) using spectral flux onset detection. Decode the audio to 22050Hz mono PCM. Compute a short-time energy function with 512-sample hop size. Find peaks in the onset function using adaptive thresholding. Compute inter-onset intervals and find the dominant tempo via autocorrelation. Output BPM as a float (e.g., 128.3). Round to one decimal for display. For tracks with multiple tempos (e.g., classical), store the primary detected tempo. Run this as part of the library scan pipeline.
- **Key detection:** After BPM, compute a chromagram (12-bin chroma vector) from the full track or the first 60 seconds. Apply the Krumhansl-Schmuckler algorithm: compare the chromagram against major and minor key profiles for all 24 keys and pick the best match. Output the key (e.g., "A minor") and confidence (0–1). Store both. Also compute the Camelot wheel code: major keys go on the outer ring (e.g., C major = 8B), minor on the inner ring (A minor = 8A). Store as a 2–3 character string (e.g., `"8A"`).
- **Energy score:** Compute RMS energy of the decoded audio, normalized to [0, 1] relative to a reference RMS of 0.25 (chosen empirically). Clamp to [0, 1]. This gives a quick sense of how "loud" or "intense" a track is.
- **Loudness (LUFS):** Compute integrated loudness per ITU-R BS.1770-4 using a K-weighted filter followed by mean square measurement over the full track. Report as a negative dBFS value (e.g., -14.2 LUFS).
- **Database columns:** Add to the `tracks` table: `bpm REAL`, `key TEXT`, `camelot TEXT`, `energy REAL`, `loudness_lufs REAL`, `analysis_version INTEGER`. The `analysis_version` column allows future re-analysis when the algorithm improves without re-scanning everything.
- **Background analysis:** Run analysis as a background job after the file is added to the library and basic metadata (title, artist, duration) has been indexed. Use a priority queue: tracks that have been played recently get analyzed first. Emit Socket.IO events for frontend progress.
- **Manual edit:** In the track's "Get Info" modal, show editable fields for BPM and Key (energy/loudness are display-only). Saving writes to both the DB and the file's tags (TXXX frame or VORBIS_COMMENT).

---

### 2.7 Waveform Seek Bar

**What it does:**
- Displays a pre-computed SVG peak waveform on the seek bar representing the amplitude envelope of the track.
- The played portion is colored in the accent color; the unplayed portion is in a muted gray.
- A/B loop markers overlay the waveform as draggable handles.
- Waveform resolution reduces automatically in Low Power Mode.

**Implementation Notes:**

- **Waveform computation:** During library scan (in the Rust worker), decode the track's audio to mono PCM at 8kHz. Divide the PCM samples into N equal-width segments (N = 300 for full resolution, N = 250 for Low Power Mode). For each segment, compute the peak absolute amplitude. Store the 300 peak values as a comma-separated string or a binary blob in the `tracks` table column `waveform_peaks TEXT`.
- **SVG rendering:** In the frontend, read the `waveform_peaks` string, split into an array of 300 floats, and render them as an SVG `<polyline>` or as a series of `<rect>` elements positioned along the seek bar. Normalize peaks to the bar height. Mirror the waveform vertically (one polyline above centerline, one below) for a classic symmetrical look.
- **Color split:** The seek bar maintains a `currentRatio = currentTime / duration` value. Apply an SVG `clipPath` or a CSS mask to color `0 → currentRatio` in the accent color and `currentRatio → 1.0` in a muted gray. Update this split on every `timeupdate` event.
- **Caching:** Once computed, waveform peaks are stored in the DB and never recomputed unless the file's modification date changes. On re-scan, check `mtime` and `file_size` before re-analyzing — skip if unchanged.
- **A/B markers overlay:** Render the A/B handles as absolute-positioned SVG triangles overlaid on the waveform bar. Implement drag-and-drop via pointer events on these SVG elements, updating `abLoop.a` and `abLoop.b` on drag end (not on every drag move, to avoid jitter).
- **Low Power Mode:** In the `useLowPowerMode()` hook, reduce N from 300 to 250. This means 50 fewer bars to render, reducing SVG complexity and paint time. The visual difference is imperceptible.
- **Fallback:** If `waveform_peaks` is NULL (track not yet analyzed), render a standard flat progress bar with a rectangular fill. No waveform is shown until analysis completes.

---

---

# 🏃 Sprint 3 — Video Playback

> **Goal:** Deliver a full-featured video experience — hardware-accelerated decode, subtitle support, PiP, chapter navigation, and gesture controls — that matches or beats VLC.

---

## 3. Video Features

---

### 3.1 Video Playback

**What it does:**
- Hardware-accelerated decoding for H.264, HEVC/H.265, AV1, and VP9 where the hardware supports it.
- A "HW Decode" badge is shown in the player UI when hardware acceleration is active.
- Silently falls back to software decode without interrupting playback if hardware acceleration is unavailable.
- Targets smooth 4K/60fps playback on capable hardware.

**Implementation Notes:**

- **Web:** Use the `<video>` element, which automatically uses hardware acceleration when the browser and OS support it for a given codec. Detect hardware decode via the `VideoDecoder` API (WebCodecs): call `VideoDecoder.isConfigSupported({codec: 'avc1.42E01E', hardwareAcceleration: 'prefer-hardware'})`. If `supported = true` and `hardwareAcceleration = 'hardware'`, show the "HW" badge.
- **Desktop (Tauri):** Use FFmpeg's hardware acceleration API. On macOS, try `VideoToolbox` (`-hwaccel videotoolbox`). On Windows, try `D3D11VA` or `DXVA2`. On Linux, try `VAAPI` or `NVDEC`. Implement a probe function in Rust that attempts to open the file with hardware decode — if it succeeds, use it and set a flag. If it throws, fall back to software decode (`-hwaccel none`).
- **"HW Decode" badge:** A small pill in the top-right corner of the video player overlay labeled "HW" in a semi-transparent green. Only show it when hardware acceleration is confirmed active. In settings (under About), list the codec-to-acceleration mapping for the current machine.
- **4K/60fps:** No special code required beyond hardware decode — the browser or OS handles the frame scheduling. Ensure the `<video>` element uses `playsinline` and that no CSS transform is applied to the video element (transforms force a repaint on each frame, negating hardware acceleration). Use `will-change: transform` on the parent container if animation is needed.

---

### 3.2 Video Controls

**What it does:**
- A floating controls overlay (play/pause, seek bar, volume, fullscreen, subtitle toggle) that auto-hides after 2 seconds of inactivity and reappears on any mouse or touch input.
- Double-click (or double-tap) to toggle fullscreen.
- Mobile gesture controls: horizontal swipe = seek, swipe up/down on left half = brightness, swipe up/down on right half = volume.
- Pinch-to-zoom for video crop/zoom.
- Aspect ratio override options: fill, fit, 4:3, 16:9, anamorphic, stretch.

**Implementation Notes:**

- **Auto-hide overlay:** Wrap all controls in an absolutely-positioned `<div class="controls-overlay">`. Use a `setTimeout` of 2000ms that sets `opacity: 0; pointer-events: none` on the overlay. Reset the timer on `mousemove`, `mousedown`, `touchstart`, or `keydown` within the video container. When the video is paused, always show the overlay (cancel the hide timer).
- **Double-click fullscreen:** Bind `dblclick` on the video container. Call `document.documentElement.requestFullscreen()` (or `videoElement.requestFullscreen()` on mobile). On exit, call `document.exitFullscreen()`. The same binding handles mobile double-tap via `touchend` events with a 300ms tap interval check.
- **Gesture controls (mobile):** Use `Hammer.js` or raw pointer events. On `panstart`, record the starting position and which half of the screen the touch began on. On `panmove`, compute the vertical delta: `dy = startY - currentY`. If left half: map `dy` to brightness using the Screen Brightness API (Capacitor plugin on native, or a CSS `brightness()` filter overlay on web). If right half: map `dy` to volume (`videoElement.volume += dy / screenHeight`). For horizontal pan, map `dx` to seek: `seekDelta = (dx / screenWidth) * 90` seconds. Apply the seek on `panend`, not on every `panmove`.
- **Pinch-to-zoom:** Use `Hammer.js` pinch recognizer. On `pinch`, apply a CSS `transform: scale(factor)` to the video element. Cap the scale at 3.0×. Add `transform: translate()` based on the pinch center point so the zoom is centered on the gesture. On `pinchend`, if scale < 1.05, snap back to 1.0×.
- **Aspect ratio:** Apply CSS object-fit and object-position to the video element: `fill` = `object-fit: fill`, `fit` = `object-fit: contain`, `16:9` / `4:3` = set explicit `width` and `height` on the video element, `anamorphic` = `object-fit: fill` with a specific width ratio, `stretch` = `object-fit: fill` at container dimensions. Store the user's preference per-file in the `tracks` table as `aspect_ratio_override TEXT`.

---

### 3.3 Subtitles

**What it does:**
- Supports SRT, VTT, and ASS/SSA subtitle formats, including external files dragged onto the player.
- Embedded subtitle streams can be selected from a menu.
- Auto-searches for subtitles online by filename hash.
- Subtitle timing can be adjusted ±10 seconds in 0.1-second steps.
- Style customization: font size, text color, background opacity, vertical position.
- Multiple subtitle tracks can be displayed simultaneously.
- A CC button is always visible in the control bar.

**Implementation Notes:**

- **SRT/VTT parsing:** Parse SRT files into a `{startMs, endMs, text}[]` array. Use regex to extract the timestamp lines (`HH:MM:SS,mmm --> HH:MM:SS,mmm`). For VTT, use a similar parser respecting the `WEBVTT` header and optional cue settings. Store the parsed cues in memory when the subtitle file is loaded. Render the active cue by checking on every `timeupdate` which cue's `startMs <= currentTimeMs < endMs`.
- **ASS/SSA parsing:** Strip override tags (`{\an8}`, `{\b1}`, etc.) and extract the text content. Basic style (italic, bold) can be preserved by mapping common tags. Full ASS rendering (positioned subtitles, karaoke effects) is out of scope — strip all positioning and render as standard bottom-of-screen subtitles.
- **Embedded subtitle extraction:** For MKV and MP4 files, run `ffprobe -print_format json -show_streams` to list all subtitle streams. Present each stream in a dropdown menu labeled by language code and codec name (e.g., "English — SRT", "French — ASS"). When selected, extract the subtitle stream using `ffmpeg -i input.mkv -map 0:s:0 -c copy output.srt` on the server side and return the SRT content to the frontend as a JSON string.
- **External subtitle drag-and-drop:** Add a `dragover` + `drop` event listener on the video container. On drop, check if the file extension is `.srt`, `.vtt`, or `.ass`. If so, read the file with `FileReader`, parse it, and load it as an overlay subtitle track. Merge with any existing subtitle tracks.
- **Auto-search:** When the user clicks "Search Online" in the subtitle panel, compute the OpenSubtitles hash: read the first and last 64KB of the video file, XOR-fold them with the file size into a 64-bit integer, and format as a hex string. Send to `GET /api/subtitles/search?hash={hash}&filename={encoded_name}`. The backend queries OpenSubtitles' REST API. Return the top 5 matching subtitle files and let the user choose one. Download and parse on selection.
- **Timing offset:** Maintain a `subtitleOffsetMs` value. Add this to every cue's `startMs` and `endMs` when checking for display. Provide a `+0.1s` / `-0.1s` button pair and a numeric input in the subtitle settings panel. Keyboard shortcut: `Shift+Z` = -0.1s, `Shift+X` = +0.1s.
- **Rendering:** Render subtitles as absolutely-positioned HTML `<div>` elements overlaid on the video container, not as WebVTT cues via `<track>` (for more style control). Apply user style preferences as inline styles: `fontSize`, `color`, `backgroundColor` (with alpha), `bottom` (for vertical position as a percentage).
- **Multiple tracks:** Allow up to 2 simultaneous subtitle tracks. Render them on separate lines — primary at the bottom, secondary slightly above it (e.g., 15% from bottom).

---

### 3.4 Audio Track Selection

**What it does:**
- Lists all audio streams embedded in a video file, labeled by language, codec, and channel count.
- Allows switching between audio tracks during playback without reloading the file.

**Implementation Notes:**

- **Stream enumeration:** Run `ffprobe -print_format json -show_streams -select_streams a` on the file at scan time. Parse the JSON output and store audio stream metadata in the `track_audio_streams` table: `{track_id, stream_index, language, codec_name, channels, sample_rate}`.
- **UI:** In the video control bar, a small "audio track" icon (headphones) opens a dropdown or bottom sheet listing all available audio streams, e.g.: "Track 1: English (AC3, 5.1)", "Track 2: Commentary (AAC, 2.0)". The currently active stream is checkmarked.
- **Switching:** When the user selects a different track, use FFmpeg to remux the file stream in real time: `ffmpeg -i input.mkv -map 0:v -map 0:a:1 -c copy -f matroska pipe:1` (substitute the selected audio stream index). The frontend switches the `<video>` source to the server-side stream URL with an added `?audio_stream=1` parameter. Implement this as a seek-resuming switch: record `currentTime` before switching, then seek to that position after the new stream loads.

---

### 3.5 Picture-in-Picture (PiP)

**What it does:**
- Opens the video in a floating overlay window in the corner of the screen via the browser's native PiP API.
- Optionally activates automatically when the user navigates away from the video page.
- PiP window includes standard playback controls (play/pause, seek).

**Implementation Notes:**

- **API:** Call `videoElement.requestPictureInPicture()` when the PiP button is clicked. This is a browser-native API available in Chrome, Edge, Firefox (behind a flag), and Safari. The resulting `PictureInPictureWindow` object has `width` and `height` properties. Listen to `pictureInPictureElement` on the `document` to know if PiP is active.
- **Auto-activate on navigate:** Use the React Router's location change effect: when the current route changes away from the video route AND video is playing, call `videoElement.requestPictureInPicture()`. This must be user-gesture initiated — trigger it only if the user has already interacted with the video on that page (track a `hasInteracted` flag set on first play).
- **Controls in PiP window:** The browser renders basic play/pause controls inside the PiP window by default. To add a "Skip 10s" button, use the Media Session API: register a `seekforward` action handler via `navigator.mediaSession.setActionHandler('seekforward', () => videoElement.currentTime += 10)`. The PiP window will show a seek button if the browser supports it.
- **Fallback for unsupported browsers:** If `document.pictureInPictureEnabled` is false, offer an alternative: a CSS-based fixed-position mini player in the bottom-right corner of the app (`position: fixed; bottom: 16px; right: 16px; width: 280px;`). This is a fallback that works entirely within the app window.
- **User setting:** In Settings → Video, a toggle "Auto-PiP when navigating away" (default: off). Store in settings table.

---

### 3.6 Chapter Navigation

**What it does:**
- Chapter markers from file metadata appear as tick marks on the video seek bar.
- Previous Chapter and Next Chapter buttons appear in the control bar when chapters are available.
- A chapter list panel lets users click any chapter to jump directly to it.

**Implementation Notes:**

- **Metadata parsing:** At scan time, extract chapter data using `ffprobe -print_format json -show_chapters`. Store in the `track_chapters` table: `{track_id, chapter_index, title, start_time_ms, end_time_ms}`. For Podcast RSS chapters (Podcast 2.0 `<podcast:chapters>` JSON endpoint), fetch and parse the JSON chapters file, storing the same structure.
- **Seek bar tick marks:** If a track has chapters, render small vertical tick marks on the waveform/progress bar at positions `(chapter.start_time_ms / duration_ms) * barWidth`. On hover over a tick, show a tooltip with the chapter title.
- **Prev/Next buttons:** Show `|◀` and `▶|` buttons in the control bar only when the current track has chapters. Clicking Next Chapter: find the first chapter whose `start_time_ms > currentTimeMs + 500` (the 500ms prevents accidentally staying on the same chapter when seeking). Clicking Prev Chapter: if `currentTimeMs > current_chapter.start_time_ms + 2000`, seek to `current_chapter.start_time_ms` (restart the chapter). Otherwise, seek to `previous_chapter.start_time_ms`.
- **Chapter list panel:** A sidebar or bottom sheet showing all chapters as a scrollable list: chapter number, title, and start time. Clicking any chapter seeks to `start_time_ms`. The currently active chapter (the last one whose start time is ≤ currentTime) is highlighted with the accent color.

---

### 3.7 Video Thumbnails

**What it does:**
- A preview thumbnail is generated from each video file during library scanning.
- Hovering over the seek bar shows a small thumbnail preview at the hovered timestamp.
- Thumbnails are cached to disk and not regenerated unless the file changes.

**Implementation Notes:**

- **Generation:** In the Rust scan worker, after indexing a video file, call `ffmpeg -i input.mkv -ss {25% of duration} -frames:v 1 -vf scale=320:-1 thumbnail_{trackId}.jpg`. Save the output to `~/.zovyra/thumbnails/{trackId}.jpg`. On web, send the file to the server which performs the same FFmpeg extraction and returns a JPEG blob, stored in IndexedDB.
- **Hover scrub preview:** On seek bar `mousemove`, compute the hovered timestamp. Send `GET /api/thumbnails/{trackId}?at={timestampSeconds}`. The server extracts a frame at that timestamp using `ffmpeg -ss {t} -frames:v 1`. Cache extracted frames in a server-side `Map<trackId+timestamp, jpgBuffer>` (cap at 100 entries). Render the returned image in a small floating `<img>` element (width: 160px) above the seek bar at the cursor position.
- **Performance:** Pre-extract thumbnails at 10 keyframe positions per video during an idle background job (not during scan, which is higher priority). This means 10 scrub positions are cached and render instantly. Positions between cached frames are extracted on demand.
- **Change detection:** In the scan pipeline, compare the file's current `mtime` and `file_size` against stored values in the `tracks` table. Only re-generate the thumbnail if either has changed.

---

### 3.8 Video Enhancements

**What it does:**
- Brightness, contrast, saturation, and hue adjustments available in the video settings panel.
- Deinterlacing toggle for legacy interlaced video content.
- Rotation options: 0°, 90°, 180°, 270°, persisted per file.
- Mirror/flip horizontal toggle.

**Implementation Notes:**

- **CSS filters (web):** Apply brightness, contrast, and saturation as CSS `filter` values on the `<video>` element: `filter: brightness(1.1) contrast(1.05) saturate(0.9)`. Use `hue-rotate(Ndeg)` for hue. These are GPU-accelerated on all modern browsers. Expose four sliders in a "Video Enhancements" panel: Brightness (0.5–2.0, default 1.0), Contrast (0.5–2.0, default 1.0), Saturation (0.0–2.0, default 1.0), Hue (−180° to +180°, default 0°). Build the filter string from all four values and apply to the video element on any change.
- **FFmpeg post-processing (native desktop):** On Tauri, apply `ffmpeg` filters: `-vf eq=brightness=0.1:contrast=1.05:saturation=0.9,hue=h=30`. Rebuild the FFmpeg pipeline when the user changes these values. Apply a 300ms debounce before rebuilding to avoid rebuilding on every slider tick.
- **Deinterlacing:** Add an `yadif` filter in the FFmpeg pipeline for desktop: `-vf yadif=mode=1`. On web, there is no native deinterlacing in the browser — offer a note: "Deinterlacing is only available on the desktop app."
- **Rotation:** Apply `transform: rotate(90deg)` or `rotate(180deg)` or `rotate(270deg)` to the video element's container. Swap width and height CSS dimensions accordingly for 90° and 270° rotations (to prevent overflow). Store `rotation_degrees INTEGER DEFAULT 0` per track in the `tracks` table. Apply on load.
- **Mirror/flip:** Apply `transform: scaleX(-1)` to the video element. Can be combined with rotation transforms using a combined CSS `transform` string. Store `mirror_flip BOOLEAN DEFAULT 0` per track.

---

---

# 🏃 Sprint 4 — Library & Collection Management

> **Goal:** Build the indexing backbone — folder watching, a high-performance virtualized grid, metadata editing, duplicate detection, and instant search across 100k+ tracks.

---

## 4. Library & Collection Management

---

### 4.1 Folder Watching

**What it does:**
- Users add one or more root folders. ZOVYRA recursively scans them for audio and video files.
- Real-time scanning progress shows "Scanned N of M" with tracks appearing in the grid as they are found.
- Incremental re-scans only process changed files (path + modification date + file size check). A 10,000-track re-scan with no changes completes in under 100ms.
- A file watcher detects new, modified, or deleted files and updates the library automatically.
- Deleted files are marked `missing = 1` rather than removed, preserving playlist references.

**Implementation Notes:**

- **Desktop (Tauri):** Use the `Chokidar` npm library in the Node.js server layer (or the `notify` Rust crate via NAPI-RS) to watch the configured root folders recursively. On `add` event: trigger indexing for the new file. On `change` event: re-scan that specific file's tags and update the DB row. On `unlink` event: set `missing = 1` on the corresponding `tracks` row.
- **Web (PWA):** Use the File System Access API. Call `showDirectoryPicker()` to get a `FileSystemDirectoryHandle`. Store the handle in IndexedDB (handles can be serialized). On each app load, call `handle.queryPermission({mode: 'read'})` — if granted, begin scanning without re-prompting. Use polling (check every 30 minutes) instead of a true file watcher, since the browser API doesn't support watch events.
- **Incremental scan logic:** Maintain a `scan_cache` table: `{path TEXT PRIMARY KEY, mtime INTEGER, file_size INTEGER, track_id INTEGER}`. During a scan, stat each file and compare `mtime` and `file_size` against the cache. If both match, skip the file (no re-parse needed). If either differs, re-parse tags and update the `tracks` row. New files (path not in cache) are inserted into both `tracks` and `scan_cache`. Deleted paths (in cache but not on disk) get `missing = 1`.
- **Real-time progress:** Emit Socket.IO events from the server: `library:scan:progress {scanned: N, total: M, latestTrack: {id, title, artist, coverArtPath}}`. The frontend subscribes and updates a progress bar and appends each new track to the live grid.
- **`missing = 1` behavior:** Never hard-delete tracks from the DB. When `missing = 1`, show the track in the library with a distinct "missing" visual: a broken-link icon overlay on the cover art, muted text color. Attempting to play a missing track shows a toast: "File not found — Locate file?" with a button to browse for the new path (writes the new path to the `tracks` row and clears `missing`).

---

### 4.2 Library Grid / List View

**What it does:**
- A virtualized grid that renders at most 60 DOM nodes regardless of library size, even at 500,000+ tracks.
- Audio tracks show cover art (lazy-loaded with blurred placeholder), title, artist, and duration. Video files show a thumbnail with a duration badge.
- Three view modes: grid, compact list, and album view.
- Sticky sortable column headers in list view.
- Multi-select with Shift+click (range), Ctrl/Cmd+click (individual), and bulk actions.

**Implementation Notes:**

- **Virtualization:** Use `react-window` (`FixedSizeGrid` or `VariableSizeList`) or `@tanstack/virtual` for the library grid. These libraries only render the visible rows/columns plus a small overscan buffer. Configure overscan to 5 rows above and below the viewport. The scrollable container's `height` is fixed to the viewport height.
- **Data fetching:** Do not load all tracks into memory. Use a paginated API: `GET /api/tracks?offset=0&limit=100&sort=artist&order=asc`. As the user scrolls near the bottom of loaded data, fetch the next page. Maintain a flat in-memory array with placeholder `null` values for unloaded positions, replaced as pages arrive.
- **Cover art lazy loading:** Use the `IntersectionObserver` API. Each grid cell's `<img>` tag starts with `src` unset and a blurred low-res placeholder (a 4×4 pixel JPEG of the dominant color, stored in the DB as a base64 string). When the cell enters the viewport (observer fires), set `img.src = /api/covers/{trackId}`. The browser decodes and renders it. On successful load, transition from the blurred placeholder to the actual art with a 200ms CSS opacity fade.
- **View modes:** Toggle button group (grid / list / album) in the toolbar. Store the preference in `settings`. Grid mode: 3–6 columns depending on viewport width. List mode: full-width rows with columns. Album mode: group by `album_artist + album`, showing one row per album with click-to-expand track list.
- **Column sort (list mode):** Column headers are `<button>` elements. Clicking toggles sort order (ASC → DESC → none). Show a ▲ or ▼ icon. Multi-column sort: Shift+click a second column sets it as the secondary sort key. These sort parameters are passed to the API as `?sort=artist&sort2=year&order=asc`.
- **Multi-select:** Track a `selectedTrackIds: Set<number>` in component state. `Shift+click` on a track selects the range from the last clicked track to the current one. `Ctrl/Cmd+click` toggles individual selection. When 1+ tracks are selected, show a floating action bar at the bottom: "N selected | Add to Playlist ▾ | Rate ▾ | Delete | More ▾."

---

### 4.3 Context Menu (right-click on any track)

**What it does:**
Provides a rich right-click context menu with actions: Play Now, Play Next, Add to Queue, Add to Playlist (sub-menu), Add to Listen/Watch Later, Rate (inline stars), Get Info, Show in File Explorer, Find Duplicates, Identify Track, Edit Tags, Move to Trash, Copy File Path.

**Implementation Notes:**

- **Implementation:** Use a custom React context menu component (not the browser native `contextmenu`). On `contextmenu` event, prevent default, compute the mouse position, and render a `<div>` absolutely positioned at those coordinates with `position: fixed; z-index: 9999`. Close the menu on any click outside it or on `Escape`.
- **Play Next:** Insert the track(s) into the queue immediately after the currently playing track. If multiple tracks are selected, insert them in order.
- **Add to Playlist sub-menu:** On hover, fetch `GET /api/playlists` and render a secondary menu listing all playlists. Clicking one calls `POST /api/playlists/{id}/tracks` with the track IDs. Show a "✓ Added" checkmark animation for 1 second.
- **Rate inline:** Show 5 star icons that are hoverable. Clicking a star calls `POST /api/tracks/{id}/rate` with `{rating: N}` and updates the DB.
- **Show in File Explorer:** On desktop (Tauri), call `shell.open(path.dirname(trackPath))` which opens the folder in Finder (macOS) or Explorer (Windows) with the file highlighted. On web, show the file's directory path in a toast ("File is at: /path/to/folder") since file system access is sandboxed.
- **Find Duplicates:** Open the duplicates panel (§4.7) pre-filtered to show only groups containing this track.
- **Identify Track:** Trigger AcoustID fingerprint lookup (§18.1) for this specific track and show results in the "Get Info" modal.
- **Move to Trash:** On desktop, use Tauri's `fs.removeFile` with a trash API. On web, mark `missing = 1` and add a flag `user_deleted = 1` — actual deletion is not possible from the web sandbox. Show an undo toast for 5 seconds.

---

### 4.4 Search

**What it does:**
- Results appear as the user types, in under 50ms for libraries with 100,000+ tracks.
- Searches across title, artist, album, album artist, genre, file path, year, and comments.
- Supports operator syntax: `bpm:>120 key:Am energy:>0.7`.
- Recent searches shown below the search box as dismissible chips.
- Toggle to scope search to Library, Playlists, Podcasts, or Radio.

**Implementation Notes:**

- **FTS5 full-text search:** Create a SQLite FTS5 virtual table: `CREATE VIRTUAL TABLE tracks_fts USING fts5(title, artist, album, album_artist, genre, file_path, year, comment, content='tracks', content_rowid='id')`. Keep it in sync via triggers on `INSERT`, `UPDATE`, and `DELETE` on the `tracks` table. Query with `SELECT rowid FROM tracks_fts WHERE tracks_fts MATCH ?` — SQLite FTS5 returns results in milliseconds for millions of rows.
- **< 50ms target:** The FTS5 query itself is fast. Ensure the result set is limited: `LIMIT 200`. Return only the `rowid` (track ID) from FTS5, then fetch full track details from the `tracks` table in a single `WHERE id IN (...)` query. Use a WAL journal mode and memory-mapped I/O for SQLite.
- **Operator search parsing:** Before sending the query to FTS5, parse operator tokens from the input string using a regex: `/(\w+):(>=?|<=?|=)?([^\s]+)/g`. Extract structured filters (e.g., `bpm > 120`, `key = Am`). Remove these tokens from the query string and pass the remainder to FTS5. Apply the structured filters as additional `WHERE` clauses in the SQL query joined with FTS5 results.
- **Recent searches:** Store the last 10 searches in `localStorage` as a JSON array. On search box focus, show them as chips below the input. Clicking a chip restores the query. An ✕ button on each chip removes it from the list.
- **Scope toggle:** A row of small pill buttons below the search box: "Library | Playlists | Podcasts | Radio." Each changes the SQL query target. "Playlists" searches playlist names and their track contents. "Radio" searches station names and genres via the Radio Browser local cache.

---

### 4.5 Sorting & Filtering

**What it does:**
- Sort by any of: title, artist, album, year, date added, play count, rating, BPM, energy, duration, file size, missing status.
- Multi-column sort (primary + secondary key).
- Filter sidebar with genre, artist, album, year, rating, file type, and missing status facets.
- A "Show Missing Files Only" quick filter.

**Implementation Notes:**

- **Sort:** All sorting happens via SQL `ORDER BY` in the backend API. Pass `?sort=bpm&sort_dir=desc&sort2=artist&sort2_dir=asc` as query parameters. The backend validates these fields against an allowlist (never string-interpolate raw column names — use a `switch` statement to map field names to SQL column identifiers).
- **Filter sidebar:** The sidebar is a collapsible left panel on desktop and a bottom sheet on mobile. Each section (Genre, Artist, Year, etc.) shows the top 20 facet values with counts: `SELECT genre, count(*) as n FROM tracks WHERE missing=0 GROUP BY genre ORDER BY n DESC LIMIT 20`. When the user clicks a facet value, add it to the active filter set and re-query. Multiple values in the same facet = OR logic. Different facets = AND logic.
- **Missing files filter:** A toggle switch at the top of the sidebar labeled "Missing files only" that sets `WHERE missing = 1` in the query. When active, the grid shows only missing tracks with their broken-link visual style.
- **State:** Store active sort and filter state in the URL query string (e.g., `/library?sort=bpm&genre=Gospel&rating=4`) so the view is shareable and survives navigation.

---

### 4.6 Metadata Editor (Get Info)

**What it does:**
- A modal editor for all standard tags: title, artist, album, album artist, year, genre, track/disc number, comment, composer, lyrics.
- Also edits analysis fields: BPM, key, energy.
- Cover art can be viewed, replaced by drag-and-drop, fetched from MusicBrainz, or removed.
- Changes are written immediately to the file via Rust tag writer with zero audio re-encoding.
- Bulk edit: select multiple tracks, edit shared fields simultaneously.
- Undo available within 30 seconds of writing (§18.3).

**Implementation Notes:**

- **Modal layout:** A two-column layout: left column = cover art (large square, drag-and-drop target, with "Fetch from MusicBrainz" and "Remove Art" buttons below it); right column = a form with labeled text inputs for all tag fields, organized in sections ("Core", "Track Info", "Analysis").
- **Dirty state tracking:** Track which fields have been changed (a `dirtyFields: Set<string>` state). Only write changed fields to the file — do not rewrite all tags if only the title changed.
- **Tag writing:** Call `POST /api/tracks/{id}/tags` with the changed fields as a JSON body. The server routes this to the Rust tag writer (§18.3). Show a loading spinner on the Save button while writing. On success, update the in-memory track data and close the modal.
- **Bulk edit:** When multiple tracks are selected, open a "Bulk Edit" variant of the modal. Show only fields that are commonly shared (artist, album, genre, year, disc number). Fields where the selected tracks have differing values show a placeholder "— varies —" in the input. Entering a value in a field applies it to all selected tracks. Only the edited fields are written. Bulk writes are queued and processed serially to avoid file I/O contention.
- **Cover art fetch:** Call `GET /api/covers/search?artist={artist}&album={album}` which queries the MusicBrainz Cover Art Archive and returns up to 5 candidate URLs. Show them as thumbnail choices. On click, download the selected image and call the tag writer to embed it.

---

### 4.7 Duplicate Detection

**What it does:**
- Detects duplicate tracks even across different encodings or bitrates using a waveform fingerprint of the first 60 seconds at 8kHz.
- Results shown in side-by-side cards: file path, size, bitrate, format, last played.
- The recommended "Keep" file (highest bitrate / most recently played) is highlighted.
- Trash controls with a 5-second undo.
- Scans run in the background without affecting playback.

**Implementation Notes:**

- **Fingerprint computation:** In the Rust worker, for each track, decode the first 60 seconds of audio to 8kHz mono PCM. Down-sample to 32 floats per second (1920 floats total). Compute a locality-sensitive hash (LSH) of this fingerprint: divide into 8 segments of 240 floats, compute the sign of each float (1-bit quantization per float), pack into a 240-bit hash per segment. Store all 8 segment hashes in a `fingerprint_lsh` table alongside the `track_id`.
- **Duplicate matching:** To find duplicates, for each track, find all other tracks where at least 5 of the 8 segment hashes have a Hamming distance of ≤ 10 bits. Group matches into clusters. Run this as a background job: `POST /api/library/find-duplicates`. Return a list of groups, each containing 2+ tracks.
- **UI:** Show duplicate groups as a vertical list. Each group is an expandable card showing the tracks side by side. Columns: cover art, title, artist, format (e.g., "FLAC 24-bit"), bitrate (kbps), file size, last played. Highlight the recommended "Keep" track with a green badge. Each track has a "Move to Trash" button. After moving to trash, show an undo toast for 5 seconds: "Moved to Trash · Undo."
- **Background scanning:** Run the fingerprint comparison query during idle time (when no playback is active). Use `setImmediate` between each group check to avoid blocking the event loop. Allow playback to preempt the scan — if the user starts playing, the scan pauses.

---

### 4.8 Album View

**What it does:**
- A grid of albums with artwork, title, artist, year, and track count.
- Clicking an album opens a detail page: track list, total duration, year, genre, "Play All" and "Shuffle All" buttons.
- An artist page shows the full discography sorted by year, top tracks, and total listening time for that artist.

**Implementation Notes:**

- **Album grouping:** Group tracks by `(album_artist ?? artist, album)` — never by album name alone (different artists can share album names). Query: `SELECT album_artist, album, MIN(year) as year, COUNT(*) as track_count, MAX(cover_art_path) as cover FROM tracks GROUP BY coalesce(album_artist, artist), album ORDER BY album_artist, year DESC`.
- **Album detail page:** Routed at `/album/{albumId}` (where `albumId` = URL-encoded `"albumArtist::albumName"`). Fetch all tracks belonging to this album ordered by `disc_number, track_number`. Show total duration as "H:MM:SS." "Play All" enqueues all tracks in order. "Shuffle All" Fisher-Yates shuffles the track list, then enqueues.
- **Artist page:** Routed at `/artist/{artistName}`. Two sections: "Discography" (album cards sorted by year DESC) and "Top Tracks" (top 10 by `play_count DESC`). Show a stat: "You've listened to {artist} for {total_hours} hours total" computed by summing `seconds_played` from `playback_history` for all tracks by this artist.

---

### 4.9 Folder/Path Browser

**What it does:**
- A traditional folder tree view for users who prefer to browse their media by directory structure rather than by metadata.
- Preserves folder hierarchy without flattening into the unified library.

**Implementation Notes:**

- **Tree data:** Build the folder tree from the `file_path` column of the `tracks` table. Extract directory paths and build a nested tree structure in memory. Use a recursive SQL CTE or process in Node.js: `paths = tracks.map(t => path.dirname(t.file_path))`. Build a trie from these paths.
- **UI:** Render as an expandable tree (accordion-style). Each node shows: folder icon, folder name, child count (folders + files). Clicking a leaf folder shows all tracks in that directory in the main library grid (filtered by `file_path LIKE '/path/to/folder/%'`). Include a breadcrumb trail at the top: "Music / Artists / Radiohead / OK Computer."
- **Toggle:** This view is accessible from a "Folder Browser" tab in the library sidebar, not the default view. The default library view is the unified metadata-based grid.

---

---

# 🏃 Sprint 5 — Queue, Flow & Discovery

> **Goal:** Make the listening flow feel intelligent and effortless — smart queue behavior, shuffle modes, history, and content-based + collaborative filtering recommendations all from the local library.

---

## 5. Queue & Playback Flow

---

### 5.1 Queue Panel

**What it does:**
- A slide-in panel from the right side showing the current playback queue.
- Tracks can be reordered by dragging, and removed with a swipe on mobile.
- The currently playing track is highlighted with an animated equalizer-bars icon.
- Buttons to remove duplicates from the queue and clear the entire queue (with undo).
- Auto-scrolls to the current track when it changes.

**Implementation Notes:**

- **Panel implementation:** A fixed-position `<aside>` sliding in from the right with a CSS `transform: translateX(100%)` that transitions to `translateX(0)` when opened. Use a `backdrop-filter: blur(4px)` semi-transparent overlay behind it on mobile. The panel should be 360px wide on desktop and full-width on mobile.
- **Queue data model:** Maintain `queue: {trackId, queueItemId (UUID), position}[]` in the global Zustand store. The `queueItemId` is needed to disambiguate duplicate tracks in the queue. All queue mutations (add, remove, reorder) update this store and persist to the `queue_items` SQLite table.
- **Drag-to-reorder:** Use `@dnd-kit/sortable` for drag-and-drop. Assign each queue item a `SortableItem` wrapper. On `onDragEnd`, update the `position` values of all affected items. Commit the new order to the DB as a batch update: `UPDATE queue_items SET position = ? WHERE id = ?` for each changed row.
- **Swipe-to-remove (mobile):** Use a swipe gesture recognizer on each queue item row. On swipe-left past a threshold (80px), reveal a red "Remove" button beneath the row. On full swipe-out or button tap, remove the item from the queue store and DB.
- **Animated equalizer icon:** The currently playing item shows an animated SVG of three vertical bars oscillating at different heights and speeds. Use a CSS `@keyframes` animation. Pause the animation when the player is paused (via a class toggle).
- **Remove Duplicates:** Button runs: find all `trackId` values that appear more than once in the queue. Keep the first occurrence of each, remove the rest. Show a toast: "Removed N duplicate(s)."
- **Auto-scroll:** When `currentTrackId` changes (either from play next or user selection), use `element.scrollIntoView({behavior: 'smooth', block: 'center'})` on the current queue item's DOM node after a 100ms delay (to allow any re-render to complete).

---

### 5.2 Shuffle Modes

**What it does:**
- Off: plays in the listed queue order.
- On: true random shuffle (Fisher-Yates algorithm).
- Smart Shuffle: uses the recommendation engine to pick the next track by similarity score rather than random chance.

**Implementation Notes:**

- **State:** Store `shuffleMode: 'off' | 'on' | 'smart'` in the playback store. Cycle through these three states on each click of the shuffle button, showing a different icon for each.
- **Fisher-Yates (On mode):** When shuffle is enabled, compute a shuffled order of the queue indices using the Fisher-Yates algorithm in a single pass. Store this shuffled order as a `shuffleOrder: number[]` array. Track `shufflePosition` (which position in this array we're at). "Next" moves to `shuffleOrder[shufflePosition + 1]`. "Previous" moves back through the shuffle history (not to `shufflePosition - 1` in the shuffled order, but to the actual previously played track from a `shuffleHistory` stack).
- **Smart Shuffle:** When advancing to the next track, instead of random or sequential, call `GET /api/recommendations/similar?trackId={currentId}&candidateIds[]={all unplayed queue track IDs joined by commas}&limit=1`. The server returns the single most similar unplayed queue track. Use this as the next track. This means the queue "floats" — tracks in the queue are played in a similarity-optimized order rather than the listed order. The queue panel shows the list order, not the play order, while "Up Next" shows the recommendation-determined next track.
- **Icon states:** Off = two arrows icon in muted color. On = two arrows icon in accent color. Smart = two arrows icon with a small sparkle/AI badge overlay.

---

### 5.3 Repeat Modes

**What it does:**
- Off: stop after the last track in the queue.
- Repeat One: loop the current track indefinitely.
- Repeat All: loop the entire queue from the beginning after the last track.

**Implementation Notes:**

- **State:** Store `repeatMode: 'off' | 'one' | 'all'` in the playback store. Cycle on click.
- **Repeat One:** In the `onTrackEnd` handler, check `repeatMode`. If `'one'`, call `seek(0)` and `play()` without advancing the queue pointer.
- **Repeat All:** When the queue pointer would advance past the last track, reset it to 0 and continue playback.
- **Icon:** Standard repeat icon (circular arrows). Repeat One adds a small "1" badge over the icon.

---

### 5.4 Queue Persistence & History

**What it does:**
- The full playback history — not just "recently played" — is recorded in order, going back as far as storage allows.
- A History panel lets users scroll back through past sessions.
- Any historical track can be played again with one tap.

**Implementation Notes:**

- **History table:** `CREATE TABLE playback_history (id INTEGER PRIMARY KEY, track_id INTEGER, session_id TEXT, played_at INTEGER, seconds_played INTEGER, completed BOOLEAN, source TEXT)`. `source` can be `'queue'`, `'radio'`, `'recommendation'`, etc. Append a new row every time a track finishes (or is skipped after 5+ seconds).
- **History panel UI:** A route `/history` or a tab in the library sidebar. Render as a timeline: group entries by date ("Today", "Yesterday", "Monday May 12", etc.). Each entry shows cover art, title, artist, played_at time, and a "▶ Play Again" button. Use virtualized rendering for long histories.
- **Play Again:** Adds the track to the front of the queue and begins playback immediately.
- **Storage limits:** Keep the last 10,000 history entries (about 3–5 months of heavy use). A nightly cleanup job deletes entries older than 10,000 rows.

---

### 5.5 Smart Queue Continuation

**What it does:**
- When the queue empties (repeat off, last track finished), automatically fetches 10 similar tracks and appends them to the queue.
- Shows a dismissible toast informing the user.
- Can be disabled in settings.

**Implementation Notes:**

- **Trigger:** In the `onTrackEnd` handler, after determining the queue is empty and repeat is off, call `GET /api/recommendations/continue?seedTrackId={lastTrackId}&limit=10`. The API returns 10 track IDs from the library that are similar to the last played track, using the content-based + co-play recommendation engine (§6.1-6.2).
- **Toast:** Show a non-blocking toast at the bottom: "Queue finished — Added 10 similar tracks · [Undo]." The undo button removes the appended tracks from the queue. Auto-dismiss the toast after 8 seconds.
- **Setting:** A toggle in Settings → Playback: "Continue playing after queue ends" (default on). When off, playback simply stops when the queue is exhausted.

---

### 5.6 Up Next Preview

**What it does:**
- The bottom of the Now Playing view shows the next 3 tracks in the queue.
- Tapping any of these tracks skips to it immediately.

**Implementation Notes:**

- **Data:** Read `queue[currentIndex + 1 .. currentIndex + 3]` from the queue store. These are the next 3 items.
- **UI:** A "Up Next" section below the album art and controls in the Now Playing view. Each item: small cover art thumbnail (40×40px), title (truncated), artist, duration. A right-pointing chevron "›" indicates it's tappable.
- **Tap to skip:** Tapping an "Up Next" item sets the queue pointer directly to that item's index and begins playback. The skipped items remain in the history and are marked as skipped (`completed = false`, `seconds_played = 0`).

---

## 6. Discovery & Recommendations

---

### 6.1 Content-Based Recommendations

**What it does:**
- Each track has a feature vector built from its analysis metadata: `[BPM/250, key_numeric, scale_binary, energy, loudness_normalized]`.
- Cosine similarity is computed between track vectors.
- A "More Like This" button on any track opens a 20-track recommendation panel.
- Missing analysis values fall back to the population median.

**Implementation Notes:**

- **Feature vector:** Normalize each dimension to [0, 1]: `bpm_norm = bpm / 250` (capped at 1.0), `key_norm = key_index / 11` (0 = C, 11 = B), `scale_norm = 1 if major else 0`, `energy = energy` (already [0,1]), `loudness_norm = (loudness_lufs + 60) / 60` (maps -60→0 LUFS to [0,1]). Store this 5-float vector in the `tracks` table as `feature_vector TEXT` (JSON array).
- **Population medians:** On library scan completion, compute the median of each feature dimension across all tracks with non-null values. Cache in the `settings` table. Substitute median for any null dimension when building the vector for a specific track.
- **Cosine similarity:** In Node.js: `sim(a, b) = dot(a,b) / (magnitude(a) * magnitude(b))`. For "More Like This", fetch all track feature vectors from the DB, compute cosine similarity against the seed track, sort descending, return top 20 (excluding the seed itself and recently played tracks from the last hour).
- **Performance:** With 10,000 tracks and 5-float vectors, the in-memory cosine similarity computation takes ~5ms in Node.js. Pre-load all feature vectors into a `Float32Array` buffer on server startup for maximum performance. For 100,000 tracks, use a k-d tree or approximate nearest neighbor library (e.g., `hnswlib-node`).
- **UI:** "More Like This" opens a slide-in panel with 20 track cards. Each shows a similarity percentage (cosine sim converted to a % between 50% and 100%). Buttons: "Play All," "Add All to Queue," or click individual tracks to play/queue.

---

### 6.2 Co-Play Collaborative Filtering

**What it does:**
- Tracks played in the same session accumulate a co-play score with each other.
- Recommendations blend content similarity (40%) with co-play score (60%).
- All filtering is based solely on the user's own local history — no external data.

**Implementation Notes:**

- **Co-play table:** `CREATE TABLE co_play (track_a INTEGER, track_b INTEGER, score REAL DEFAULT 0, PRIMARY KEY (track_a, track_b))`. When a session ends (or periodically during a session), increment co-play scores for all pairs of tracks played in that session: for each pair (a, b) where a ≠ b, `INSERT OR REPLACE INTO co_play VALUES (a, b, old_score + 1)`. Normalize a and b so `a < b` always (to avoid double-counting).
- **Blended score:** When computing recommendations for a seed track, for each candidate: `blendedScore = contentSimilarity(seed, candidate) * 0.4 + coPlayScore(seed, candidate) / maxCoPlayScore * 0.6`. Sort by blended score descending.
- **Co-play score lookup:** `SELECT score FROM co_play WHERE (track_a = ? AND track_b = ?) OR (track_a = ? AND track_b = ?)`. Normalize the result by dividing by the maximum co-play score in the table. This gives a [0, 1] value for the co-play dimension.
- **Cold start:** New tracks with no co-play history get a co-play score of 0 and rely entirely on content similarity for recommendations. This is graceful — new additions surface via content similarity immediately.

---

### 6.3 Mood-Based Radio

**What it does:**
- Six mood channels: Focus, Energized, Relaxed, Happy, Melancholy, Spiritual.
- Each mood maps to a target energy range, BPM range, and preferred key profile.
- A "Mood Detector" home card lets the user tap a mood and receive a 50-track queue.
- Time-of-day pre-bias optionally adjusts the default mood suggestion.

**Implementation Notes:**

- **Mood profiles (server constants):**
  ```
  Focus:     energy [0.3, 0.6], bpm [70, 110], major_preference: 0.5
  Energized: energy [0.7, 1.0], bpm [120, 180], major_preference: 0.7
  Relaxed:   energy [0.1, 0.4], bpm [50, 90],  major_preference: 0.6
  Happy:     energy [0.5, 0.8], bpm [90, 140],  major_preference: 0.9
  Melancholy:energy [0.2, 0.5], bpm [50, 90],  major_preference: 0.1
  Spiritual: energy [0.3, 0.6], bpm [60, 100], major_preference: 0.5
  ```
- **Playlist generation:** `GET /api/radio/mood?mood=focus&limit=50` queries the `tracks` table: `WHERE energy BETWEEN ? AND ? AND bpm BETWEEN ? AND ? AND missing = 0`. If fewer than 50 results, relax the constraints (widen by 10% each dimension). Return 50 randomly sampled tracks from the result set (not the full result — use SQLite's `ORDER BY RANDOM() LIMIT 50`).
- **Time-of-day pre-bias:** Read the current hour on the server. Map: 5am–11am → Energized, 11am–5pm → Focus, 5pm–9pm → Happy, 9pm–12am → Relaxed, 12am–5am → Melancholy. On the home screen, show the time-biased mood pre-selected (highlighted). The user can override by tapping any other mood.
- **UI:** Six large circular buttons with emoji icons and mood names. Show track count for each mood: "342 tracks" beneath the label. A loading spinner appears for 300ms while the query runs. Then the queue panel opens with the 50 tracks loaded.

---

### 6.4 AI Playlist via Natural Language

**What it does:**
- A text prompt input field (e.g., "lo-fi beats for late-night coding") that generates a playlist from the local library.
- Queries the Anthropic API to interpret the prompt and extract parameters: mood, genre, energy range, BPM range.
- Builds the playlist from local library tracks matching those parameters.
- Optionally augments with radio stations if the local library lacks matches.
- One-tap playlist save.

**Implementation Notes:**

- **API call:** Send the user's prompt to `POST /api/ai/playlist-prompt` on the backend. The server calls the Anthropic API (`claude-sonnet-4-20250514`) with a system prompt: "You are a music parameter extractor. Given a user's playlist description, return a JSON object with: `{mood, genres: [], energy_min, energy_max, bpm_min, bpm_max, key_preferences: [], vibe_description}`. Return only valid JSON, no other text." The user message is their raw prompt.
- **Library query:** Parse the returned JSON and query the `tracks` table: `WHERE genre IN (genres) AND energy BETWEEN energy_min AND energy_max AND bpm BETWEEN bpm_min AND bpm_max AND missing = 0 ORDER BY RANDOM() LIMIT 25`. If fewer than 10 results, relax parameters and re-query.
- **Radio augmentation:** If library results < 10, query the Radio Browser API for stations matching the genre tags in the response. Append up to 5 matching radio stations to the playlist as "stream" entries.
- **UI:** A text input with a send button (or Enter key) in a "Make a playlist" card on the home screen. While the AI processes, show a shimmer loading card. On success, open the playlist panel showing the generated tracks with a playlist title auto-set to the user's prompt (truncated to 50 chars). A "Save Playlist" button creates the playlist in the DB. A "Regenerate" button runs the query again with the same parameters but different random tracks.
- **Error handling:** If the Anthropic API returns an error or non-JSON, fall back to a keyword-based search (treat the prompt words as a library search query) and notify the user: "AI unavailable — showing keyword results instead."

---

### 6.5 Artist Radio

**What it does:**
- Generates a continuous stream from the local library filtered to a selected artist and similar artists.

**Implementation Notes:**

- **Similar artist detection:** Similarity is based on genre tag overlap and co-play score. `GET /api/radio/artist?artistName={name}` queries: first, fetch all tracks by the named artist. Then compute co-play scores between these tracks and all other artists' tracks to find artists that frequently appear in the same listening sessions. Return the top 5 similar artists. Build the queue from all tracks by the seed artist (randomly ordered) + a random 20% sample from each similar artist.
- **Seamless continuation:** When the queue empties, auto-expand to include more tracks from the same artist pool (Smart Queue Continuation, §5.5, but pre-seeded with this artist radio context).

---

### 6.6 Listening History Recommendations

**What it does:**
- A "Based on what you've been listening to lately" home section shows tracks not recently played that are similar to the user's 7-day listening pattern.

**Implementation Notes:**

- **7-day pattern vector:** Compute the centroid (average) of the feature vectors of all tracks played in the last 7 days. This gives a "vibe centroid" vector representing the user's recent taste.
- **Recommendation query:** Find tracks in the library NOT played in the last 7 days (`track_id NOT IN (SELECT track_id FROM playback_history WHERE played_at > ?)`) with a high cosine similarity to the centroid. Return top 20.
- **Refresh cadence:** Recompute on app launch and every 6 hours during active use. Cache the result set in the `settings` table as a JSON array of track IDs.
- **UI:** A horizontally scrolling row of track cards on the home screen, labeled "Sounds like your week." Show 10 cards. A "See all" button opens a full-screen version.

---

### 6.7 Penalization & Boosting

**What it does:**
- Tracks skipped more than 50% of the time get a 0.3× similarity penalty in recommendations.
- Tracks played to completion at least 3 times get a 1.5× boost.
- Star ratings directly influence recommendation weighting (5 stars = strong boost, 1 star = strong penalty).

**Implementation Notes:**

- **Skip rate:** Compute per track: `skip_rate = skip_count / (play_count + skip_count)`. Store `skip_count INTEGER DEFAULT 0` and `play_count INTEGER DEFAULT 0` in the `tracks` table. Increment `skip_count` when a track is skipped before the 50% mark. Increment `play_count` on every play start.
- **Weighting factors:** When computing blended recommendation scores, apply a final multiplier:
  - If `skip_rate > 0.5`: multiply final score by `0.3`.
  - If `play_count >= 3 AND skip_rate < 0.3`: multiply by `1.5`.
  - If `rating = 5`: multiply by `2.0`.
  - If `rating = 4`: multiply by `1.5`.
  - If `rating = 2`: multiply by `0.5`.
  - If `rating = 1`: multiply by `0.1`.
  - If `rating = 3 or null`: multiply by `1.0` (neutral).
- Apply these multipliers after computing the blended content+co-play score, before sorting.

---

---

# 🏃 Sprint 6 — Playlists, Lyrics & Podcasts

> **Goal:** Complete the content consumption surface — smart and regular playlists with full CRUD, synced/translatable lyrics with an editor, and a full podcast player with progress sync.

---

## 7. Smart Playlists & Automation

---

### 7.1 Smart Playlist Editor

**What it does:**
- A visual rule editor: select a field, an operator, and a value to define rules. Match mode toggles between ALL (AND) and ANY (OR). Limit and sort controls. A live preview shows how many tracks match before saving.
- All queries use parameterized SQL to prevent injection.

**Implementation Notes:**

- **Rule data model:** Each rule is `{field: string, operator: string, value: string | number}`. The entire smart playlist definition is stored in the `playlists` table as a JSON blob in a `smart_rules TEXT` column alongside `smart_match_mode TEXT ('all'|'any')`, `smart_limit INTEGER`, `smart_sort TEXT`, `smart_sort_dir TEXT`.
- **SQL generation:** On the server, map each rule to a SQL fragment using a strict allowlist:
  ```
  field mapping: { 'title': 'title', 'artist': 'artist', 'bpm': 'bpm', ... }
  operator mapping: { 'is': '= ?', 'contains': 'LIKE ?', 'greater_than': '> ?', 'in_last_N_days': '> (unixepoch() - ? * 86400)', ... }
  ```
  Build the `WHERE` clause by joining fragments with `AND` or `OR` based on `match_mode`. Wrap in a parameterized `sqlite3` prepared statement — never string-concatenate user input.
- **Live preview:** Debounce (500ms) any rule change and call `GET /api/playlists/preview?rules={JSON encoded rules}`. The backend runs `SELECT COUNT(*) ...` and returns the count. Display it as a badge: "42 tracks match."
- **UI:** Rules are rendered as a vertical list of rows, each with three dropdowns (field, operator, value/input) and a red `-` remove button. A `+` button at the bottom adds a new rule. The field dropdown lists all supported fields grouped by category ("Track Info", "Playback Stats", "Analysis"). When the field changes, the operator dropdown updates to show only applicable operators for that field type (text, number, date).

---

### 7.2 System Smart Playlists

**What it does:**
Nine pre-built smart playlists that refresh nightly at 3am: Most Played, Recently Added, Forgotten Favorites, New Discoveries, Top Skipped, Long Tracks, High Energy, Deep Cuts, Lately Loved.

**Implementation Notes:**

- **Storage:** These are stored as regular smart playlist rows in the `playlists` table with `is_system = 1` (non-deletable and non-editable by the user, though visible).
- **Nightly refresh:** Use a `node-cron` job scheduled at `'0 3 * * *'` (3am daily). For each system playlist, re-run its query and update a cached `system_playlist_tracks` join table. This pre-computation means opening these playlists is instant (no dynamic query on open).
- **Hardcoded rules:**
  - Most Played: `play_count > 0 ORDER BY play_count DESC LIMIT 25`
  - Recently Added: `added_at > (now - 14 days) ORDER BY added_at DESC`
  - Forgotten Favorites: `play_count >= 5 AND last_played < (now - 90 days) ORDER BY play_count DESC`
  - New Discoveries: `added_at > (now - 30 days) AND play_count < 2 ORDER BY added_at DESC`
  - Top Skipped: `skip_count > 3 ORDER BY skip_count DESC LIMIT 25`
  - Long Tracks: `duration_seconds > 480 ORDER BY duration_seconds DESC`
  - High Energy: `energy > 0.7 AND bpm > 120 ORDER BY energy DESC`
  - Deep Cuts: `play_count = 0 AND added_at < (now - 7 days) ORDER BY RANDOM() LIMIT 25`
  - Lately Loved: `rating >= 4 AND last_played > (now - 30 days) ORDER BY rating DESC, last_played DESC`

---

### 7.3 Regular Playlists

**What it does:**
Full CRUD for manual playlists, with drag-to-reorder tracks, duplication, merging, notes, cover art, and M3U/ZOVYRA JSON import/export.

**Implementation Notes:**

- **Data model:** `playlists {id, name, description, cover_art_path, created_at, updated_at, is_system, smart_rules, ...}`. `playlist_tracks {playlist_id, track_id, position INTEGER}`. Use `position` for manual ordering (integer, not fractional — use the "gap" reordering approach: on reorder, renumber positions for the affected range only rather than all rows).
- **Drag-to-reorder tracks:** Same `@dnd-kit/sortable` approach as the queue panel. On drop, update `position` values in a batch DB update.
- **Duplicate a playlist:** `POST /api/playlists/{id}/duplicate` — copies the playlist row (with a new name like "Playlist Name (Copy)") and all `playlist_tracks` rows with a new `playlist_id`. Responds with the new playlist's ID so the frontend can navigate to it.
- **Merge playlists:** A "Merge into..." action in the playlist context menu. Opens a picker showing all other playlists. On confirm, appends all tracks from the current playlist into the selected target playlist (de-duplicated by track ID). Preserves the target playlist's existing tracks and order.
- **M3U export:** Generate an M3U8 file: `#EXTM3U` header, then for each track: `#EXTINF:{duration},{artist} - {title}\n{file_path}`. For absolute paths on desktop and relative paths on web. Trigger a file download via `URL.createObjectURL(new Blob([m3uContent], {type: 'audio/mpegurl'}))`.
- **ZOVYRA JSON export:** A richer format: `{version: 1, name, created_at, tracks: [{id, title, artist, album, year, duration, file_path}]}`. This preserves metadata so the playlist can be reconstructed on another device by path or by metadata matching.
- **M3U import:** Parse the `#EXTINF` lines to extract artist/title. Try to match each entry against the library by file path first, then by `(artist + title)` fuzzy match. Report: "Imported 18 of 20 tracks (2 not found in library)."

---

### 7.4 Listen Later / Watch Later

**What it does:**
Two-tap save from any track context menu. Dedicated queue panels for each. Auto-removes entries on play completion (configurable). Sortable by date added, duration, artist.

**Implementation Notes:**

- **Storage:** Two special playlists with `is_system = 1` and names `"_listen_later"` and `"_watch_later"`. Tracks are added via `POST /api/playlists/listen-later/tracks`. All the regular playlist track management applies.
- **Auto-remove on completion:** In the `onTrackEnd` handler, if `completed = true` and the track was sourced from the "Listen Later" playlist, call `DELETE FROM playlist_tracks WHERE playlist_id = {listenLater.id} AND track_id = ?`. Configurable via a toggle in the Listen Later panel settings.
- **UI:** Accessible from the sidebar as "Listen Later" and "Watch Later" with a clock badge showing the count. The panel shows tracks in a list view with a drag handle for reordering and a trash button for each item.

---

## 8. Lyrics

---

### 8.1 Three-Tier Lyrics Fetching

**What it does:**
- First, check the track's embedded tag (USLT for ID3, LYRICS for VORBIS_COMMENT) and any local `.lrc` file alongside the audio file.
- If not found locally, query the LRCLIB API for synced lyrics using artist + title + duration.
- Synced `.lrc` format is preferred; plain text lyrics are the fallback.

**Implementation Notes:**

- **Tier 1 (embedded tags):** When loading a track, read the `USLT` frame (ID3) or `LYRICS` comment (VORBIS/OGG) using the Rust tag reader. If the value looks like an LRC file (first line matches `/\[(\d{2}):(\d{2}\.\d{2,3})\]/`), parse it as synced lyrics. Otherwise, treat as plain text.
- **Tier 2 (local .lrc file):** Check for a file at the same path as the audio file but with `.lrc` extension: e.g., `song.mp3` → `song.lrc`. If found, read and parse as LRC.
- **Tier 3 (LRCLIB):** If tiers 1 and 2 yield nothing, call `GET https://lrclib.net/api/get?artist_name={artist}&track_name={title}&duration={duration_seconds}`. Parse the JSON response: `syncedLyrics` (LRC format string) or `plainLyrics`. Cache the result in a `lyrics_cache` SQLite table: `{track_id, source, synced_lrc, plain_text, fetched_at}`.
- **LRC parsing:** Parse LRC into an array: `{timeMs: number, text: string}[]`. Regex: `/\[(\d{2}):(\d{2}\.(\d{2,3}))\](.+)/`. Convert `[MM:SS.mmm]` to milliseconds. Sort by `timeMs` ascending.

---

### 8.2 Synced Lyrics Display

**What it does:**
- The active lyric line is shown in the accent color, larger font, vertically centered. Inactive lines are blurred. Lines smooth-scroll into center as playback advances. Tapping a line seeks to that timestamp. Animation speed is configurable.

**Implementation Notes:**

- **Active line tracking:** In the lyrics component, subscribe to `currentTimeMs` from the playback store. On each update, binary-search the parsed LRC array for the last cue whose `timeMs <= currentTimeMs`. That cue index is the active line.
- **Auto-scroll:** Use a `ref` on each lyric line `<div>`. When the active line changes, call `activeLineRef.current.scrollIntoView({behavior: 'smooth', block: 'center'})`. Wrap this in a `requestAnimationFrame` to batch with the next render.
- **Styling:** Use CSS for the inactive blur effect: `.lyric-line { filter: blur(1.5px); opacity: 0.5; transition: all 0.3s ease; }`. `.lyric-line.active { filter: none; opacity: 1; font-size: 1.15em; color: var(--accent-color); }`. The transition property handles the smooth animation between states.
- **Tap to seek:** Each lyric line `<div>` is clickable. `onClick={() => seekTo(cue.timeMs / 1000)}`.
- **Configurable animation:** In Settings → Lyrics, expose a "Transition speed" slider: Slow / Medium (default) / Fast. Map to CSS transition duration values: `0.5s / 0.3s / 0.1s`. Apply via a CSS variable.
- **Fallback (plain text):** If no timestamps are available, render all lyrics lines in the same style with no active highlighting or scroll behavior. Center the block vertically in the lyrics panel.

---

### 8.3 Lyrics Translation

**What it does:**
- One-click translation of lyrics to any language via LibreTranslate.
- Translated lyrics are cached per track per language.
- Side-by-side original + translation view.

**Implementation Notes:**

- **LibreTranslate API call:** `POST /api/lyrics/translate` with body `{trackId, targetLanguage}`. The server calls LibreTranslate (self-hosted or the public instance at `libretranslate.com`): `POST /translate` with `{q: plainLyricsText, source: 'auto', target: targetLanguage}`.
- **Cache:** Store in `lyrics_translations {track_id, language_code, translated_text, fetched_at}`. On subsequent requests for the same `(trackId, language)`, return the cached value.
- **Language selector:** A dropdown listing all LibreTranslate target languages returned from `GET /languages` endpoint. Pre-populate the dropdown on first use and cache the language list locally.
- **Side-by-side view:** When a translation is active, split the lyrics panel into two equal columns: left = original (synced scroll), right = translation (plain text, scrolls in sync). On mobile (single column), add a toggle to switch between original and translation.

---

### 8.4 Lyrics Editor

**What it does:**
- Manual edit mode for fixing wrong lyrics.
- A karaoke-style LRC builder: play the track and tap a button to set the timestamp for each line.
- Save changes back to the embedded tag or a local `.lrc` file.

**Implementation Notes:**

- **Edit mode toggle:** A pencil icon in the lyrics panel header switches from view mode to edit mode. In edit mode, each lyric line becomes an editable `<textarea>`. The timestamp is shown as an editable `[MM:SS.mm]` prefix. Users can type new lyrics or correct existing ones.
- **Timestamp builder (karaoke mode):** A dedicated "Build Timestamps" mode. Shows all lyric lines without timestamps. A large "Mark ▶" button is displayed. The user plays the track and taps "Mark" at the start of each line — the current playback position is recorded as the timestamp for that line. Lines advance automatically (no need to click the correct line). After all lines are marked, review the result.
- **Save flow:** "Save to File" writes the LRC content to a `.lrc` file alongside the audio file (using the Tauri filesystem API on desktop or triggering a download on web). "Save to Tag" embeds the lyrics in the audio file's `USLT` or `LYRICS` tag via the Rust tag writer. Update the `lyrics_cache` in the DB to reflect the new content.

---

## 9. Podcasts

---

### 9.1 Subscription Management

**What it does:**
- Subscribe to podcasts via RSS URL. Feeds are parsed and stored locally.
- Search the iTunes Podcast Directory to find shows by name.
- Feeds auto-refresh every 6 hours.
- Unsubscribing prompts whether to delete downloaded episodes.

**Implementation Notes:**

- **RSS parsing:** `POST /api/podcasts/subscribe` with `{rssUrl}`. The server fetches the RSS XML, parses it with an XML parser (`fast-xml-parser`), and extracts: show title, author, description, artwork URL, and all episodes (title, pubDate, duration, enclosure URL, show notes HTML, chapter URL). Store in `podcasts {id, title, author, description, artwork_url, rss_url, last_refreshed, refresh_interval_hours}` and `podcast_episodes {id, podcast_id, title, pub_date, duration_seconds, enclosure_url, description_html, chapter_url, listened_seconds, completed, downloaded}`.
- **iTunes search:** `GET /api/podcasts/search?q={query}` calls `https://itunes.apple.com/search?media=podcast&term={query}&limit=20`. Parse the JSON results (fields: `trackName`, `artistName`, `artworkUrl600`, `feedUrl`). Show results as a list; tapping subscribes by calling the subscribe endpoint with the `feedUrl`.
- **Auto-refresh:** A `node-cron` job runs every 6 hours: `'0 */6 * * *'`. For each subscribed podcast, fetch the RSS, compare episode GUIDs against existing DB rows, and insert new episodes. Emit a Socket.IO event `podcast:new_episodes {podcastId, count}` to trigger a UI badge update.
- **Unsubscribe:** `DELETE /api/podcasts/{id}` first shows a confirmation modal: "Delete downloaded episodes? [Keep] [Delete]." If "Delete", call `fs.unlink` for each downloaded episode file before removing the DB row. The podcast row and all its episode rows are deleted (`ON DELETE CASCADE`).

---

### 9.2 Episode List

**What it does:**
- Per-podcast episode list: artwork, title, date, duration, listen progress bar.
- Filters: All / Unplayed / Downloaded / In Progress.
- Bulk mark-all-as-played.
- Episode detail page with rendered HTML show notes, links, and chapter markers.

**Implementation Notes:**

- **Progress bar:** Each episode row shows a thin progress bar: `width = (listened_seconds / duration_seconds) * 100%`. Color: accent color for the listened portion. Episodes with `completed = 1` show a checkmark ✓ overlay.
- **Filter tabs:** Four pill tabs at the top of the episode list. "All" = no filter. "Unplayed" = `completed = 0 AND listened_seconds < 5`. "Downloaded" = `downloaded = 1`. "In Progress" = `listened_seconds > 5 AND completed = 0`. Pass as query param to `GET /api/podcasts/{id}/episodes?filter=unplayed`.
- **Show notes rendering:** Use `DOMPurify.sanitize(html)` to sanitize the `description_html` and render it with `dangerouslySetInnerHTML`. This enables rich show notes with links, headers, and lists while preventing XSS.
- **Chapters:** If the episode has a `chapter_url` (Podcast 2.0), fetch and parse the JSON chapter file at playback time (not at subscription time, to avoid excessive network requests). Show chapter markers on the episode's seek bar.

---

### 9.3 Podcast Playback Controls

**What it does:**
- 15-second back, 30-second forward skip buttons. Speed selector (0.5× to 2×). Per-podcast speed memory. Trim silence toggle. Volume boost (+6dB).

**Implementation Notes:**

- **Skip buttons:** Two dedicated buttons in the podcast player overlay: "◀15" and "30▶". `onClick: seekTo(currentTime - 15)` and `seekTo(currentTime + 30)`. Standard podcast UI convention.
- **Speed selector:** A pill-button row showing `0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2`. Tapping sets `playbackRate` on the audio element (with pitch correction enabled — see §1.5). Save the selected speed to `podcasts.preferred_speed`. When a new episode of the same podcast starts, auto-apply `preferred_speed`.
- **Trim silence:** Use a `DynamicsCompressorNode` with an extreme ratio as a noise gate, or — better — implement a real-time silence detection: in the time-domain audio data (from the `AnalyserNode`), detect segments where `RMS < threshold` for > 300ms and increase `playbackRate` to 2.5× during those segments, then return to normal speed. This is computationally cheap: check in the RAF loop and update `playbackRate` accordingly. A toggle in the podcast player controls enables/disables this per episode (persisted per podcast).
- **Volume boost:** Apply a fixed `+6dB` gain on the `GainNode` in the audio graph when enabled. Show a "Boost" badge on the volume control. Store `volume_boost BOOLEAN` per podcast.

---

### 9.4 Progress Sync

**What it does:**
- Exact episode position is remembered and resumed, even across devices via LAN sync.
- Episodes are auto-marked as played at 90% listened.
- Position syncs to other connected devices via the LAN sync protocol (§13).

**Implementation Notes:**

- **Position write:** Every 10 seconds during podcast playback, write `UPDATE podcast_episodes SET listened_seconds = ? WHERE id = ?`. On the next play of the same episode, `seekTo(listened_seconds)` immediately after load.
- **90% completion:** In the `timeupdate` handler, check `currentTime / duration >= 0.9`. If so and `completed = 0`, set `completed = 1`. Trigger any post-completion behaviors (auto-remove from Listen Later queue, mark in UI with ✓).
- **LAN sync:** Emit a `podcast:progress {episodeId, listened_seconds}` sync event via the LAN sync protocol. Other devices listening on the sync WebSocket update their local DB accordingly.

---

### 9.5 Download & Offline

**What it does:**
- Download any episode for offline playback. Smart download rules auto-download the latest N episodes per podcast on Wi-Fi. Storage usage per podcast visible in settings.

**Implementation Notes:**

- **Download:** `POST /api/podcast-episodes/{id}/download`. The server streams the `enclosure_url` to a local file at `~/.zovyra/podcasts/{podcastId}/{episodeId}.mp3`. Track progress via Socket.IO `download:progress` events. On completion, set `podcast_episodes.downloaded = 1` and `local_path = '...'`.
- **Smart download rules:** A per-podcast setting: "Auto-download latest N episodes" (N = 1, 3, 5, or "All new"). Enforced by the nightly cron job: after refreshing the feed, check how many undownloaded episodes exist. Download the newest N if on Wi-Fi (check network type via `navigator.connection.type` on web or the OS network API on desktop).
- **Storage breakdown:** `GET /api/storage/podcasts` returns per-podcast storage usage: `{podcastId, name, totalMb, episodeCount}`. Show in Settings → Storage as a list with a delete button per podcast (deletes all downloaded files for that show but keeps the subscription).

---

---

# 🏃 Sprint 7 — Radio, Downloads & Offline

> **Goal:** Implement internet radio with ICY metadata and mood channels, plus the full download manager with Wi-Fi enforcement, smart rules, and storage management.

---

## 10. Radio

---

### 10.1 Internet Radio (Radio Browser API)

**What it does:**
- Search radio stations by name, genre tag, or country. Top stations list. Play via a server-side streaming proxy.

**Implementation Notes:**

- **Radio Browser API:** Base URL: `https://de1.api.radio-browser.info/json`. Endpoints used: `GET /stations/search?name={q}&limit=20`, `GET /stations/bytag/{tag}?limit=20`, `GET /stations/topclick/20`. All calls are made server-side (to avoid CORS) and proxied via `GET /api/radio/search`, etc.
- **Streaming proxy:** `GET /api/radio/stream?stationId={id}` fetches the station's `url_resolved` from the Radio Browser API, then pipes the HTTP stream through to the client with the header `Icy-MetaData: 1` set on the upstream request. This is necessary to receive ICY metadata. The proxy reads ICY metadata from the stream (in-band, every `icy-metaint` bytes) and emits `radio:metadata {stationId, title}` events via Socket.IO to the frontend.
- **UI:** A search bar at the top of the Radio section. Below it: a "Top Stations" horizontally scrollable row, then a genre tag cloud (fetch via `GET /tags?limit=50&order=stationcount`) rendered as pill buttons. Tapping a genre tag filters the station list. Each station card: station logo (from `favicon` field), name, country flag, current listener count, play button.

---

### 10.2 ICY Metadata

**What it does:**
- Extracts the "Now Playing" track title from the radio stream's ICY metadata. Displays it in the mini-player. Provides an "Identify this song" button.

**Implementation Notes:**

- **ICY parsing in proxy:** The ICY metadata spec: the server sends `icy-metaint: N` in the response headers. Every N bytes of audio data, a 1-byte length indicator (multiply by 16 to get byte count) precedes a UTF-8 metadata block containing `StreamTitle='Artist - Title';`. Parse this block in the Node.js proxy using a streaming buffer. Emit the extracted title via Socket.IO to the frontend.
- **Mini-player display:** Subscribe to `radio:metadata` events. When received, animate the "Now Playing" text in the mini-player with a smooth fade-out → update → fade-in transition (200ms each).
- **"Shazam this" button:** When the user taps this button, capture a 10-second audio sample from the stream (buffer the last 10 seconds of audio data in the proxy), then pass it to the AcoustID fingerprint service (§18.1). Display the matched track title/artist in a toast or bottom sheet.

---

### 10.3 Mood Radio

**What it does:**
- Six pre-tuned mood channels (Focus, Workout, Worship, Sleep, Party, Chill) that immediately start streaming a matching radio station.

**Implementation Notes:**

- **Station selection:** Map each mood to a set of genre tags: `Focus: ['ambient', 'study', 'lofi']`, `Workout: ['workout', 'edm', 'techno']`, `Worship: ['christian', 'gospel', 'worship']`, `Sleep: ['ambient', 'sleep', 'nature']`, `Party: ['pop', 'dance', 'party']`, `Chill: ['chill', 'jazz', 'soul']`. Call `GET /api/radio/search?tag={genre}&limit=5` for each, pick the station with the highest `votes` count, and start streaming it.
- **UI:** Six large mood cards on the Radio tab's home section. Each card has a color gradient, an emoji icon, and a mood label. Tapping a card immediately starts streaming (show a loading spinner for ≤500ms while the station URL is fetched).

---

### 10.4 Artist Radio (Local)

**What it does:**
- Generates a queue from the local library containing all tracks by a selected artist plus tracks from similar artists.

**Implementation Notes:** See §6.5. The Radio tab surfaces this as a "Local Artist Radio" option — a search input that autocompletes to artist names in the library. Selecting one triggers the same logic as §6.5.

---

### 10.5 Favorites & History

**What it does:**
- A persistent, reorderable list of favorite radio stations. Recently played stations section with timestamps. Offline: last 24h of station metadata served from cache.

**Implementation Notes:**

- **Favorites:** `radio_favorites {id, station_id, station_name, station_url, favicon_url, position}`. Add/remove via a heart icon on each station card. Drag-to-reorder uses the same `@dnd-kit/sortable` approach.
- **Recently played:** Append to `radio_history {station_id, played_at}` when playback starts. Show the last 10 entries with a `format(played_at, 'relative')` timestamp (e.g., "2 hours ago"). Clicking re-starts the stream.
- **Offline cache:** Cache each station's metadata (name, URL, favicon) in the `radio_stations` SQLite table after the first play. When the Radio Browser API is unreachable (no network), serve from this local cache and show a banner: "Showing cached stations — Connect to internet to refresh."

---

## 11. Downloads & Offline

---

### 11.1 Download Manager

**What it does:**
- Manages up to 3 concurrent downloads (FIFO queue). Retries failed downloads up to 3 times with exponential backoff (5s, 15s, 45s). Real-time progress shown as a percentage and bytes transferred.

**Implementation Notes:**

- **Queue architecture:** The `DownloadManager` class in `server/src/services/DownloadManager.ts` maintains a queue array and an `active` set. When `active.size < maxConcurrent (3)` and the queue is non-empty, dequeue the next item and begin downloading. Use Node.js `https.get()` with a response pipe to `fs.createWriteStream()`. Track bytes received via `response.on('data', chunk => { downloaded += chunk.length; emit progress; })`.
- **Progress events:** Emit `download:progress {downloadId, downloadedBytes, totalBytes, percent}` via Socket.IO every 500ms. The frontend renders a progress bar for each active download in a "Downloads" panel (accessible from the sidebar).
- **Retry logic:** On download failure (network error, non-200 status), check `attemptCount`. If `< 3`, schedule a retry after `[5000, 15000, 45000][attemptCount]` ms using `setTimeout`. Increment `attemptCount`. After 3 failures, set status to `'error'` and emit a `download:error {downloadId, reason}` event.
- **Pause/Resume/Cancel:** Implement by maintaining a reference to the `http.ClientRequest` object per active download. Cancel = call `request.destroy()` and set status to `'cancelled'`. Pause = call `request.destroy()` and save `{downloaded_bytes}` in the DB. Resume = re-issue the HTTP request with `Range: bytes={downloaded_bytes}-` header (HTTP range request) and append to the existing partial file.

---

### 11.2 Wi-Fi Enforcement

**What it does:**
- A "Download on Wi-Fi only" toggle (default on). Downloads are held in `waiting_wifi` status on cellular and auto-resume on Wi-Fi reconnect. A "Download Now Anyway" manual override.

**Implementation Notes:**

- **Network detection:** On web, use `navigator.connection.effectiveType`. Values `'4g'`, `'3g'`, `'2g'`, `'slow-2g'` indicate cellular. On Tauri desktop, use the OS network API via a Tauri plugin or check by attempting a local DNS resolution. On Capacitor mobile, use the `@capacitor/network` plugin which provides `Network.getStatus()`.
- **Queue hold logic:** When a download is about to start, check the setting and current connection type. If `wifi_only = 1` and connection is cellular, set the download status to `'waiting_wifi'` and do not start the HTTP request.
- **Auto-resume:** Listen to `Network.addListener('networkStatusChange', ...)`. When `connectionType` changes to `'wifi'`, trigger `downloadManager.processQueue()` which will start any `'waiting_wifi'` items.
- **"Download Now Anyway" button:** Shown in the Downloads panel for `waiting_wifi` items. Clicking it sets a one-time override flag and immediately starts the download, ignoring the Wi-Fi restriction for this specific item only.

---

### 11.3 Smart Download Rules

**What it does:**
- Auto-download rules per playlist or podcast: "Keep the latest 5 episodes downloaded." Rules run on app start and Wi-Fi reconnect. Per-rule storage limits.

**Implementation Notes:**

- **Rules table:** `download_rules {id, type ('podcast'|'playlist'), source_id, keep_latest_n INTEGER, wifi_only BOOLEAN, max_storage_mb INTEGER}`.
- **Rule execution:** A `RuleExecutor` service runs on app start and on Wi-Fi connect. For each rule: fetch the source's N most recent episodes/tracks, compare against already downloaded items, and queue any missing items for download via `DownloadManager.enqueue()`. Before enqueuing, check `max_storage_mb` — compute current storage used by this rule and skip if adding the new download would exceed the limit.
- **UI:** In the podcast detail view and playlist detail view, a "Smart Downloads" section with toggles and a number picker for "Keep latest N." In Settings → Downloads, a master list of all rules with edit/delete.

---

### 11.4 Storage Management

**What it does:**
- Breakdown of storage by category: audio, video, podcasts, radio cache, cover art, waveforms. Auto-clean deletes oldest played files when over a limit. A "Clear all downloads" action with a 5-second undo.

**Implementation Notes:**

- **Storage query:** `GET /api/storage/breakdown` computes:
  - Audio: `SELECT SUM(file_size) FROM tracks WHERE downloaded=1 AND mime LIKE 'audio/%'`
  - Podcasts: `SELECT SUM(file_size) FROM podcast_episodes WHERE downloaded=1`
  - Covers: `du -sb ~/.zovyra/covers/` (disk usage of the covers directory)
  - Waveforms: not separately stored (embedded in DB, negligible)
  Return as `{audio_mb, video_mb, podcast_mb, cover_mb, total_mb}`.
- **Auto-clean:** A daily background job checks if `total_mb > user_limit_mb` (set in Settings → Storage → "Storage limit"). If over the limit, delete the oldest downloaded files by `last_played` date (ascending). Never delete a currently-playing or queued file. Repeat until under the limit. Emit a `storage:cleaned {freedMb, deletedCount}` event.
- **"Clear all downloads":** A red button in Settings → Storage. On click, show a confirmation dialog. On confirm, set `downloaded = 0` for all tracks, delete all files in the downloads directories. Show a 5-second undo toast. Undo restores the DB flags but does not re-download the files (user would need to re-download manually).

---

### 11.5 Offline-First Architecture

**What it does:**
- The app loads and renders even with no network connection. All local library content is accessible offline. An offline indicator is shown in the header.

**Implementation Notes:**

- **Service Worker (web):** The app shell (HTML, CSS, JS bundles) is pre-cached via a Workbox service worker during the PWA install. API responses that are cacheable (track metadata, cover art URLs) are cached using a "stale-while-revalidate" strategy. Audio files are served from IndexedDB if downloaded.
- **Offline indicator:** Subscribe to `window.addEventListener('online')` and `'offline'`. When offline, show a subtle pill in the header: "● Offline" in amber. External-dependent features (lyrics fetch, MusicBrainz, Radio Browser) disable their fetch buttons and show "Unavailable offline" tooltips.
- **Graceful degradation:** All API calls in services are wrapped with try/catch. If a call fails due to network error, the service logs it and returns cached data (or null). Never show an unhandled error to the user. Use the `offline` detection to proactively disable features that require network rather than letting them fail.

---

---

# 🏃 Sprint 8 — Stats, Sync & Remote Control

> **Goal:** Give users deep insight into their listening habits via a full stats dashboard and Year Recap, then tie all their devices together with LAN sync and QR-based remote control.

---

## 12. Stats & Listening History

---

### 12.1 Play Events

**What it does:**
- Every playback start and end is recorded with track ID, timestamp, seconds played, and completion status.

**Implementation Notes:**

- **Frontend events:** In `PlaybackEngine`, on track load and play: `POST /api/stats/event` with `{type: 'start', trackId, startedAt: Date.now(), sessionId}`. On track end, skip, or app close (via `beforeunload` beacon): `POST /api/stats/event` with `{type: 'end', trackId, startedAt, endedAt, secondsPlayed, completed: secondsPlayed / duration >= 0.9}`. Use `navigator.sendBeacon()` for the `beforeunload` event to ensure it fires even when the tab is closing.
- **Backend:** Insert into `playback_history {track_id, session_id, started_at, ended_at, seconds_played, completed, source, device_id}`. `device_id` comes from the `settings.device_id` UUID (generated on first run and persisted). This allows multi-device history attribution.
- **Threshold:** Ignore `start` events where `seconds_played < 5` on the end event — these are accidental plays (user clicked a track and immediately changed their mind). The `5-second rule` keeps stats meaningful.

---

### 12.2 Stats Dashboard

**What it does:**
- Top Tracks, Top Artists, Top Genres leaderboards with proportional bar charts. A 7×24 heatmap of listening intensity. Total time listened. Skip Champion. Completion Rate. Daily Streaks. Filterable by period: 7d / 30d / 90d / all time.

**Implementation Notes:**

- **Period filter:** All queries accept a `period` parameter. Map to SQL: `7d = started_at > (unixepoch() - 7*86400)`, etc.
- **Top Tracks query:** `SELECT track_id, COUNT(*) as play_count, SUM(seconds_played) as total_seconds FROM playback_history WHERE started_at > ? AND seconds_played > 5 GROUP BY track_id ORDER BY play_count DESC LIMIT 10`. Join with `tracks` to get title, artist, cover art.
- **Heatmap:** `SELECT strftime('%w', started_at, 'unixepoch') as day_of_week, strftime('%H', started_at, 'unixepoch') as hour, COUNT(*) as plays FROM playback_history GROUP BY day_of_week, hour`. Render as a 7-column (Sunday–Saturday) × 24-row (0–23h) CSS grid. Each cell's background opacity scales from 0 (no plays) to 1 (max plays). Add a hover tooltip: "Wednesday 10pm: 47 plays."
- **Daily Streaks:** Query distinct `DATE(started_at, 'unixepoch')` values ordered ascending. Compute the longest consecutive-day run and the current streak (days up to today). Display on the home screen as a fire icon 🔥 with the streak count.
- **Completion Rate:** `SELECT (SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as rate FROM playback_history WHERE seconds_played > 5`. Display as a percentage with a circular progress ring.
- **Skip Champion:** `SELECT track_id, MAX(skip_count) FROM tracks WHERE skip_count > 0`. Show with a 💨 icon.

---

### 12.3 Year Recap

**What it does:**
- A full-screen animated card stack (like Spotify Wrapped) showing: Total Hours, #1 Track, #1 Artist, #1 Genre, Most Active Day, Most Active Hour, and a "Sound Identity" personality label. Exportable as a 1080×1920 shareable image.

**Implementation Notes:**

- **Data computation:** `GET /api/stats/recap?year={year}` runs all the necessary queries for the calendar year and returns a JSON object with all stat values.
- **Sound Identity:** A rule-based label derived from the user's genre + energy profile:
  ```
  if top_genre in ['gospel', 'worship', 'christian'] → "Gospel Soul"
  if avg_energy > 0.7 AND avg_bpm > 130 → "High-Energy Explorer"
  if most_active_hour >= 22 OR most_active_hour <= 4 → "Late-Night Architect"
  if top_genre in ['jazz', 'classical', 'ambient'] → "Quiet Depth"
  etc.
  ```
  Add at least 10 personality labels covering common listener archetypes.
- **Card animations:** Each card is a full-viewport `<div>` positioned in a vertical stack. Use CSS `@keyframes` for entrance animations per card type: Total Hours card uses a counter animation (numbers counting up). #1 Track card shows the album art with a ripple glow. Use `IntersectionObserver` to trigger each card's animation as the user scrolls (no external animation library needed).
- **Canvas image export:** On "Export," draw to a `<canvas>` at 1080×1920px:
  1. Fill background with a gradient using the user's top genre's color palette.
  2. Draw the album art of the #1 track (scaled to ~400×400px, centered in the upper third).
  3. Draw text: "My {Year} in Music" (title), stat values in a styled grid.
  4. Draw the ZOVYRA logo in the bottom-right.
  Call `canvas.toBlob()` and trigger a download or pass to the Web Share API.

---

### 12.4 Weekly Snapshot

**What it does:**
- Every Monday, a "Your week in music" card appears on the home screen showing the top track, top artist, total minutes, and a week-over-week comparison.

**Implementation Notes:**

- **Computation:** A `node-cron` job runs every Monday at 9am: `'0 9 * * 1'`. Queries the last 7 days of `playback_history`. Computes: top track (most played), top artist (by total seconds), total_minutes_this_week, total_minutes_last_week. Stores in `weekly_snapshots {week_start, top_track_id, top_artist, total_minutes, prev_week_minutes}`.
- **Comparison:** `delta = ((total_minutes - prev_week_minutes) / prev_week_minutes * 100).toFixed(0)`. Show as "+12% more than last week" in green or "-8% less than last week" in muted red.
- **UI card:** A dismissible card at the top of the home screen. Tapping "See Full Stats" navigates to the Stats Dashboard.

---

## 13. Sync & Multi-Device

---

### 13.1 Local Network Sync (LAN)

**What it does:**
- Devices on the same Wi-Fi network discover each other automatically via mDNS and sync playback events, queue changes, playlist edits, and play history in real time via WebSocket.

**Implementation Notes:**

- **WebSocket server:** The ZOVYRA server listens on port 8766 for peer connections. Each device generates a unique `device_id` (UUID v4, stored in settings) on first run.
- **mDNS discovery:** Use the `mdns` npm package (wrapping Bonjour/Avahi). Advertise the service as `_zovyra-sync._tcp` with TXT record `{device_id, device_name}`. Listen for other `_zovyra-sync._tcp` services on the network. When a peer is discovered, connect to its WebSocket server at the discovered IP and port 8766.
- **Event broadcasting:** When any significant event occurs on this device (play, pause, queue change, rating, playlist edit), serialize it as `{type, payload, device_id, timestamp}` and send it to all connected peer WebSockets. Each peer processes the event and stores it in `sync_log {event_type, payload, source_device_id, timestamp}`.
- **Missed events replay:** When a device connects to a peer after being offline, it sends `GET ws://peer:8766/?since={lastSeenTimestamp}`. The peer replays all events from `sync_log` since that timestamp. This handles the case where a laptop was asleep while the phone kept playing.
- **Conflict resolution:** Use last-write-wins with timestamp comparison. If two devices both modified a playlist simultaneously, the one with the later timestamp wins. This is acceptable for the use case — conflicts are rare in single-user multi-device scenarios.

---

### 13.2 Cross-Device Resume

**What it does:**
- Every 30 seconds, the playing device broadcasts its position. Idle devices receive it and offer a resume prompt.

**Implementation Notes:**

- **Position broadcast:** A `setInterval` at 30s during playback sends a `playback:checkpoint {trackId, position, device_name}` sync event to all connected peers.
- **Receiving prompt:** On the idle device, when a `playback:checkpoint` event is received and the local device is not playing: show a toast at the top: "📱 Resume '{Track Title}' at 3:42 from {Device Name}? [Resume]." Tapping Resume: load the track and seek to `position`.
- **Anti-spam:** Suppress the prompt if the same `trackId` has been offered in the last 60 seconds.

---

### 13.3 Sync Status Indicator

**What it does:**
- A cloud icon in the app header showing connection status: green + peer count when connected, grey when alone, pulsing when syncing.

**Implementation Notes:**

- **State:** The sync service maintains `{connectedPeers: [{device_id, device_name, currentTrack}]}` in a React context. Update this whenever peers connect or disconnect.
- **UI:** A small icon button in the header. Click opens a popover:
  - List of connected devices: name, currently playing track, "Sync Now" button (re-sends the full local state to that device).
  - If no peers: "No devices found on this network."
- **Pulsing animation:** When a sync event is being sent or received, add a `syncing` CSS class to the icon that applies a `@keyframes` pulse animation.

---

## 14. Remote Control

---

### 14.1 Remote Control Server

**What it does:**
- A WebSocket relay on port 8765 accepts commands from remote clients and controls local playback.

**Implementation Notes:**

- **WebSocket server (port 8765):** Separate from the sync server. Accepts connections without authentication (LAN-only — relies on the user's home network for security). On command receipt: parse `{command, params}` JSON and call the corresponding local playback engine method. Commands: `play`, `pause`, `toggle`, `next`, `prev`, `seek(seconds)`, `setVolume(0-1)`, `queueJump(index)`, `addToQueue(trackId)`.
- **Full state push:** Every 2 seconds while connected, send `{state: {isPlaying, currentTrack, position, duration, queue: [{id, title, artist}], volume}}` to all connected remote clients so their UI stays in sync.

---

### 14.2 Remote Control Page (`/remote`)

**What it does:**
- A QR code on the main app links to the `/remote` web page. Scanning it on a phone opens the remote control UI.

**Implementation Notes:**

- **QR code:** `GET /api/remote/qr` generates a QR code PNG (using the `qrcode` npm package) encoding the URL `http://{local_ip}:8765/remote`. The main app displays this QR code in a "Remote Control" settings panel or via a `?` button.
- **Remote page UI:** A mobile-optimized page at `/remote`. Connects to the WebSocket on port 8765. Displays: current album art, title, artist. Play/Pause, Prev, Next buttons. A seek slider. Volume slider. Queue list. All interactions send commands to the WebSocket. State updates from the 2-second push keep the UI current.
- **Optimistic UI:** When a button is pressed, update the remote's local UI immediately (optimistic update) without waiting for the state push. This makes the remote feel responsive even over Wi-Fi.

---

---

# 🏃 Sprint 9 — AI DJ, Social & Interoperability

> **Goal:** Ship the AI DJ with harmonic mixing and voice transitions, social sharing features, and full import/export interoperability with competing platforms.

---

## 15. AI DJ & Contextual Intelligence

---

### 15.1 AI DJ Voice Transitions

**What it does:**
- The AI DJ speaks a brief introduction between tracks using the device's text-to-speech engine. Over 40 script templates cover different transition types. Music ducks to 30% volume during the speech. The next track's script is pre-generated during the current track's crossfade (zero latency). Configurable voice, and a disable toggle.

**Implementation Notes:**

- **Script generation:** At `currentTrack.duration - crossfadeDuration - 5s`, evaluate transition context: compare the current and next track's BPM, Camelot key, energy, genre, and year. Select a template based on the best match (e.g., if keys are adjacent on the Camelot wheel, use a harmonic transition template; if both tracks are from the same decade, use a decade template). Populate the template with the actual values.
- **40+ templates (examples):**
  - Harmonic match: "Coming up is {nextArtist} with '{nextTitle}' — a perfect harmonic match at {nextKey}."
  - BPM similar: "Keeping the tempo steady at {nextBPM} BPM — {nextArtist}."
  - Energy drop: "Time to ease back a little — {nextArtist} with the soothing '{nextTitle}'."
  - First of session: "Welcome to your ZOVYRA session. Kicking off with {currentArtist}."
  - Morning: "Good morning. Starting your day with {currentArtist}."
  - Artist bio (when MusicBrainz data available): "Up next is {nextArtist}, a {genre} act from {country} who started making music in {year}."
- **TTS synthesis:** Call `window.speechSynthesis.speak(new SpeechSynthesisUtterance(script))`. Before speaking, set `utterance.voice` to the user's preferred voice (from `speechSynthesis.getVoices()`). Prefer voices that match the device locale. While the utterance is speaking, `masterGain.gain.linearRampToValueAtTime(0.3, now + 0.2)`. After `utterance.onend`, ramp `masterGain.gain` back to 1.0 over 1.5 seconds.
- **Pre-generation:** When the crossfade begins, start preparing the next-next track's script. Cache the generated script string in memory so it's ready when needed.
- **Settings:** A toggle "AI DJ Voice" in Settings → Playback (default off — this is a power feature, not a default). A voice picker showing all available system voices. A preview button plays a sample utterance.

---

### 15.2 Harmonic Mixing Awareness

**What it does:**
- When Smart Shuffle or AI DJ is selecting the next track, preference is given to tracks with adjacent Camelot wheel keys, compatible BPM (±8%), and avoiding large energy drops.

**Implementation Notes:**

- **Camelot adjacency:** Parse the Camelot code (e.g., "8A"). Adjacent keys are: same number minor/major (8A ↔ 8B), number ±1 same mode (7A, 9A). Assign a harmony score: perfect match = 1.0, adjacent = 0.7, 2 steps away = 0.3, incompatible = 0. Use this score as a multiplier on the recommendation score.
- **BPM compatibility:** `bpmScore = max(0, 1 - abs(candidateBPM - currentBPM) / (currentBPM * 0.08))`. Tracks within ±8% BPM score 1.0; tracks outside that range score proportionally lower.
- **Energy flow:** Penalize candidates where `abs(candidateEnergy - currentEnergy) > 0.5`. `energyScore = max(0, 1 - (energyDelta - 0.5) * 2)` for deltas above 0.5.
- **Combined harmonic score:** `harmonicScore = camelotScore * 0.5 + bpmScore * 0.3 + energyScore * 0.2`. Multiply this into the final recommendation score.

---

### 15.3 MusicBrainz Artist Bios

**What it does:**
- Fetches disambiguation, country, and start year for artists from MusicBrainz. Caches 30 days. Used in AI DJ scripts.

**Implementation Notes:**

- **API call:** `GET https://musicbrainz.org/ws/2/artist?query={artistName}&fmt=json&limit=1`. Rate-limit to 1 request/second using a token bucket (decrement 1 token on each request; refill 1 token per second; block if 0 tokens available). Parse `artists[0]`: `{disambiguation, country, life-span.begin}`.
- **Cache:** `musicbrainz_artists {artist_name, disambiguation, country, begin_year, fetched_at}`. Cache for 30 days. On lookup, check cache first; only call the API if cache miss or stale.
- **AI DJ integration:** When building an artist biography script template, call the cached lookup synchronously (from in-memory cache if warmed, otherwise skip the bio and use a simpler template).

---

### 15.4 Mood Profile

**What it does:**
- Computes the user's current "mood fingerprint" from the last 50 played tracks. Displays on the home screen as a vibe summary. Feeds into the recommendation engine.

**Implementation Notes:**

- **Computation:** Fetch the last 50 tracks from `playback_history` (where `seconds_played > 30`). Join with `tracks` to get their feature vectors. Average each dimension across all 50 vectors to get a centroid `[avg_bpm_norm, avg_key_norm, avg_scale, avg_energy, avg_loudness_norm]`.
- **Human-readable label:** Map the centroid to a label:
  - If `avg_energy > 0.7 AND avg_bpm_norm > 0.5`: "High Energy / Fast Tempo"
  - If `avg_energy < 0.3 AND avg_scale < 0.4`: "Mellow / Introspective"
  - If `avg_scale > 0.7`: "Uplifting / Melodic"
  - etc. (define at least 8 vibe categories)
- **Home display:** A card titled "Your current vibe" showing the label and a small radar/spider chart of the 5 dimensions (SVG rendered, not a chart library). Tapping the card opens the Stats Dashboard.
- **Recommendation bias:** When generating any recommendations, mix in a 10% weight toward tracks that are close to the mood centroid (so playlists trend toward the user's current taste without being locked into it).

---

## 16. Social & Sharing

---

### 16.1 Share Track / Playlist

**What it does:**
- Share tracks as deep links. Share playlists as ZOVYRA JSON links. Share a "Now Playing" card image.

**Implementation Notes:**

- **Deep links:** Generate `zovyra://track/{trackId}` deep links on desktop (registered via Tauri's URL scheme handler) and `https://app.zovyra.app/open?trackId={id}` as a universal fallback link that opens the app or shows a "Get ZOVYRA" page.
- **Now Playing card:** On "Share Now Playing," render to a `<canvas>`: album art (centered, 300×300px), track title, artist, "Listening on ZOVYRA" footer. Call `canvas.toBlob()` and pass to the Web Share API: `navigator.share({files: [blob], title: '...', text: '...'})`. On desktop (no Web Share API), copy the image to clipboard and show a "Copied to clipboard" toast.
- **ZOVYRA JSON playlist link:** Generate a share URL containing the playlist JSON base64-encoded: `https://app.zovyra.app/import?playlist={base64}`. Any ZOVYRA app can decode and import this playlist.

---

### 16.2 Year Recap Share Card

**What it does:**
- The 1080×1920 Year Recap canvas image is shared via the system share sheet on mobile or copied to clipboard on desktop.

**Implementation Notes:** See §12.3 for canvas generation. For sharing: on mobile web, use `navigator.share({files: [canvasBlob]})`. On Capacitor native, use `@capacitor/share` plugin's `Share.share({files: [localFilePath]})` after saving the canvas to a temp file. On desktop, trigger a download: `a.href = canvas.toDataURL(); a.download = 'ZOVYRA_Recap_2025.png'; a.click()`.

---

### 16.3 In-App Friend Activity

**What it does:**
- When two ZOVYRA devices are on the same LAN sync network, show an "Also listening" indicator in the sync panel.

**Implementation Notes:**

- **Data source:** The LAN sync protocol (§13) already receives `playback:checkpoint` events from connected peers, including their `currentTrack`. Use this data directly.
- **UI:** In the sync status popover (§13.3), for each connected peer, show: device name, "🎵 {trackTitle} — {artist}" if they are currently playing. This is the extent of "friend activity" — no social graph, no cloud, just LAN.

---

## 17. Import & Export / Interoperability

---

### 17.1 Playlist Import

**What it does:**
- Import playlists from M3U/M3U8 files, ZOVYRA JSON, Apple Music XML, and Spotify (via TuneMyMusic-style URL).

**Implementation Notes:**

- **M3U parsing:** Read lines. Ignore lines starting with `#EXTM3U`. Parse `#EXTINF:{duration},{artist} - {title}` lines for metadata. The next non-comment line is the file path or URL. Match paths against the library by full path first, then by filename, then by `(artist + title)` fuzzy match using Levenshtein distance (threshold < 3). Report unmatched entries.
- **Apple Music XML:** The iTunes Library XML has a `<plist>` structure with `<dict>` per track and `<array>` of track IDs per playlist. Parse using a DOM parser. Match tracks by `<key>Location</key>` (file path) against the library.
- **ZOVYRA JSON:** Deserialize the JSON array. Match by `file_path` first, then by `{title, artist}`. This format preserves the most information and should have the highest match rate.
- **Spotify import:** ZOVYRA does not access the Spotify API directly. Instead, the user exports their playlist via a third-party service (e.g., TuneMyMusic) which produces an M3U or CSV file. ZOVYRA then imports that file. Document this flow clearly in the import UI.

---

### 17.2 Playlist Export

**What it does:**
- Export as M3U/M3U8, ZOVYRA JSON, or plain text ("Artist — Title" per line).

**Implementation Notes:**

- **Export flow:** In the playlist context menu or detail view, a "Export" button opens a format picker bottom sheet. On selection, the backend generates the file (`GET /api/playlists/{id}/export?format=m3u`) and returns it as a downloadable response (`Content-Disposition: attachment; filename="Playlist Name.m3u"`). The frontend triggers the download by creating an `<a>` element and clicking it.
- **Relative vs. absolute paths (M3U):** A toggle in the export options: "Absolute paths" (full OS paths) vs. "Relative paths" (relative to the export file location). Relative paths are more portable when moving playlists between machines with the same folder structure.

---

### 17.3 Library Backup & Restore

**What it does:**
- Full backup: exports the SQLite DB + all cover art as a compressed archive. Incremental backup: only exports changes since the last backup. Restore: imports the archive and reconciles with the current file system.

**Implementation Notes:**

- **Full backup:** `POST /api/library/backup`. The server: 1) runs `VACUUM INTO '/tmp/zovyra_backup.db'` to create a clean SQLite copy, 2) `tar -czf backup.tar.gz backup.db ~/.zovyra/covers/`, 3) returns the archive as a download. The archive does not include audio files (too large) — only the database and artwork.
- **Incremental backup:** Track a `last_backup_at` timestamp in settings. Incremental backup exports only `tracks` rows where `updated_at > last_backup_at` and cover art files newer than that date.
- **Restore:** `POST /api/library/restore` with the archive file. The server: 1) extracts the archive, 2) reads the backup DB, 3) for each track in the backup, if the `file_path` exists on the current file system: insert or update the `tracks` row (keeping analysis metadata and play history). If the path doesn't exist, insert with `missing = 1`. This means restoring on a different machine correctly flags files as missing rather than importing phantom tracks.

---

### 17.4 DLNA / UPnP Streaming (Desktop)

**What it does:**
- Browse media from DLNA-compatible devices on the local network. Cast the current playback queue to a DLNA renderer.

**Implementation Notes:**

- **DLNA discovery:** Use the `node-ssdp` package to discover UPnP/DLNA devices (sends an M-SEARCH multicast and parses NOTIFY responses). Parse the device description XML to identify media servers (`MediaServer:1` device type) and renderers (`MediaRenderer:1`).
- **Browsing:** Call the `ContentDirectory:1` service's `Browse` action (SOAP request) to list folders and tracks on the DLNA server. Display results in the library's folder browser view (§4.9) as a separate "Network Devices" source.
- **Casting:** Send a `SetAVTransportURI` SOAP request to the renderer's `AVTransport:1` service with the track's URL (served from ZOVYRA's own HTTP server so the renderer can access it). Follow with `Play` action. Control playback (pause, seek) via subsequent `AVTransport` SOAP actions.

---

### 17.5 Chromecast / AirPlay Support (Desktop + Web)

**What it does:**
- Cast audio or video to Chromecast devices. AirPlay on macOS. Cast controls in the mini-player.

**Implementation Notes:**

- **Chromecast (web):** Use the Cast Web SDK (`google.cast.framework`). Load it from Google's CDN. Initialize with an app ID (register a custom Chromecast receiver app or use the default media receiver). On cast start, call `castSession.loadMedia(new chrome.cast.media.MediaInfo(trackUrl, mimeType))`. The ZOVYRA server serves the audio file at a LAN-accessible URL (`http://{localIp}:PORT/api/stream/{trackId}`).
- **AirPlay (macOS/Tauri):** Use the native macOS AirPlay API via a Tauri plugin or Swift helper process. The `AVRoutePickerView` provides a system AirPlay button that handles all routing. Register the audio session as `AVAudioSessionCategoryPlayback`.
- **Cast controls in mini-player:** When casting is active, show a Chromecast icon in the mini-player (green = casting). Clicking it opens a cast controls sheet: current cast target name, stop casting button, volume control for the cast session.

---

---

# 🏃 Sprint 10 — Metadata, Accessibility & Personalization

> **Goal:** Wire up AcoustID fingerprinting and MusicBrainz enrichment, implement full accessibility compliance, and build out the theming and personalization layer.

---

## 18. Metadata & Track Identification

---

### 18.1 AcoustID Fingerprinting

**What it does:**
- Generates an acoustic fingerprint of a track and looks it up in the AcoustID database to identify unknown tracks or verify metadata. Results are cached.

**Implementation Notes:**

- **Fingerprint generation:** Use the `Chromaprint` library (available as a Rust binding via `chromaprint-sys` or as a compiled native binary `fpcalc`). On desktop, call `fpcalc -json {filePath}` which outputs `{duration, fingerprint}`. On the server, call `fpcalc` as a child process. The fingerprint is a base64-encoded string representing the acoustic characteristics of the first 120 seconds.
- **AcoustID lookup:** `GET https://api.acoustid.org/v2/lookup?client={apiKey}&meta=recordings+releases+releasegroups&duration={dur}&fingerprint={fp}`. Parse the response: `results[0].recordings[0]` contains `{title, artists: [{name}], releases: [{title, date}]}`. Present the top match to the user in a confirmation modal showing the old vs. new metadata.
- **Cache:** `fingerprint_cache {fingerprint_hash (SHA256 of the fingerprint string), acoustid_result_json, looked_up_at}`. On lookup, check cache first. Cache entries expire after 90 days.
- **Bulk identification:** A "Identify untagged tracks" button in the Library Audit panel triggers bulk fingerprinting for all tracks with missing title or artist tags. Process in batches of 5 (to respect AcoustID's rate limit). Show a progress modal.

---

### 18.2 MusicBrainz Enrichment

**What it does:**
- On AcoustID match, optionally fetches full release data (album art, genre tags, release date) from MusicBrainz. Rate-limited and cached 30 days.

**Implementation Notes:**

- **MBID-based lookup:** AcoustID results include a MusicBrainz Recording ID (MBID). Use it to call `GET https://musicbrainz.org/ws/2/recording/{mbid}?inc=releases+artists+genres&fmt=json`. Extract: genre tags (`tags[].name`), release date from the earliest release, album name. Write these to the track's tags via the tag writer.
- **Cover Art Archive:** With the Release MBID, call `GET https://coverartarchive.org/release/{mbid}/front-500`. Download the JPEG and embed as cover art.
- **Rate limiting:** 1 request/second to both MusicBrainz and Cover Art Archive. Implement a single shared token bucket for both hosts. Queue requests and process with appropriate delays.

---

### 18.3 Tag Writing

**What it does:**
- Writes tags back to audio files (ID3v2 for MP3, VORBIS_COMMENT for FLAC/OGG, iTunes atoms for M4A/AAC) without re-encoding. Undo available for 30 seconds.

**Implementation Notes:**

- **Rust tag writer:** Use the `id3` crate for MP3, `metaflac` for FLAC, and `mp4ameta` for M4A. Expose a NAPI-RS function: `writeTags(filePath: string, tags: Record<string, string>): void`. The function opens the file, modifies only the specified tag frames, and writes back. The audio data bytes are never touched — only the tag container is modified.
- **Snapshot for undo:** Before writing, read the current tags and store them in memory as `{filePath, originalTags, expiresAt: Date.now() + 30000}`. After writing, show a toast: "Tags saved · Undo (29s)." A countdown timer on the toast updates every second. Clicking Undo re-calls `writeTags` with `originalTags`.
- **Atomic write:** Write to a temp file first (`file.mp3.tmp`), then rename to the original path. This ensures a crash during writing doesn't corrupt the file.

---

### 18.4 Cover Art Management

**What it does:**
- Fetch art from MusicBrainz by MBID. Drag-and-drop replacement. Embed in file tag or save as `cover.jpg`. Bulk fetch for all albums missing art.

**Implementation Notes:**

- **Drag-and-drop in Get Info modal:** The cover art square in the modal is a drop target. On `drop`, read the file as an `ArrayBuffer`, convert to a JPEG if PNG (using `canvas.drawImage` + `toBlob('image/jpeg', 0.9)`), and upload to `POST /api/tracks/{id}/cover` with the image as `multipart/form-data`. The server writes the image to `~/.zovyra/covers/{trackId}.jpg` and optionally embeds it in the file tag.
- **Write to file vs. `cover.jpg`:** A setting per track in Get Info: "Save art: In file tag | As cover.jpg." "In file tag" embeds the image in the audio file's tag frames. "As cover.jpg" saves the image alongside the audio file in the same directory. Many media players recognize `cover.jpg` as album art without needing embedded art.
- **Bulk fetch:** `POST /api/library/fetch-cover-art` queues all albums with `cover_art_path IS NULL` for MusicBrainz cover art lookup. Uses the AcoustID MBID if available, otherwise falls back to a MusicBrainz release search by `(albumArtist, albumTitle)`. Process in background, respecting the 1 req/sec rate limit.

---

## 19. Accessibility

---

### 19.1 Keyboard Navigation

**What it does:**
- Full keyboard control of playback and navigation. All interactive elements reachable via Tab. Visible focus indicators.

**Implementation Notes:**

- **Global key handler:** Register a `keydown` listener on `document`. Guard it: if `event.target` is an `<input>`, `<textarea>`, or `[contenteditable]`, ignore playback shortcuts. Otherwise:
  - `Space` → play/pause (prevent default to avoid page scroll)
  - `←` / `→` → seek ±5s
  - `Shift+←` / `Shift+→` → seek ±30s
  - `↑` / `↓` → volume ±5%
  - `N` → next track
  - `P` → previous track
  - `S` → cycle shuffle mode
  - `R` → cycle repeat mode
  - `L` → toggle like/rate (5 stars if unrated, remove rating if rated)
  - `Q` → toggle queue panel
  - `F` → toggle fullscreen (video)
  - `M` → mute/unmute
  - `?` → open keyboard shortcut overlay
  - `Cmd/Ctrl+K` → open command palette
- **Tab order:** Ensure all interactive elements (buttons, sliders, links) have a logical `tabIndex` or natural DOM tab order. Never remove `outline` in CSS without providing an alternative focus style. Use `:focus-visible` pseudo-class to show focus rings only for keyboard navigation (not mouse clicks).
- **Focus indicators:** Define a CSS variable `--focus-ring: 2px solid var(--accent-color)`. Apply to all interactive elements via `*:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }`.

---

### 19.2 Screen Reader Support

**What it does:**
- ARIA labels on all buttons and controls. Live region for Now Playing announcements. Accessible seek bar.

**Implementation Notes:**

- **ARIA labels:** Every icon button must have `aria-label`: e.g., `<button aria-label="Play">▶</button>`. Sliders: `<input type="range" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow={volume * 100} aria-valuetext={`${Math.round(volume * 100)}%`}>`.
- **Live region:** A visually hidden `<div aria-live="polite" aria-atomic="true">` in the DOM. When the track changes, update its text content to `"Now playing: {title} by {artist}"`. Screen readers announce this immediately.
- **Seek bar:** The waveform seek bar is a visual element. Render an `<input type="range">` overlaid on top of it (visually hidden but in the DOM) with `aria-label="Seek"`, `min=0`, `max={duration}`, `value={currentTime}`. The range input handles keyboard seeking and screen reader interaction. The visual waveform is `aria-hidden="true"`.
- **Landmarks:** Use semantic HTML: `<header>`, `<main>`, `<nav>`, `<aside>` for sidebar, `<footer>` for mini-player. Add `role="region"` and `aria-label` to major sections: `<section aria-label="Now Playing">`.

---

### 19.3 Visual Accessibility

**What it does:**
- High-contrast mode. Reduced motion mode. Minimum 44×44px touch targets. System font size scaling.

**Implementation Notes:**

- **High-contrast mode:** A toggle in Settings → Appearance. Applies a CSS class `<html class="high-contrast">` that overrides color variables: backgrounds become pure white or pure black, text becomes maximum contrast. Test against WCAG AA contrast ratio (4.5:1 minimum for normal text).
- **Reduced motion:** Read `prefers-reduced-motion: reduce` via a CSS media query. Also provide a manual toggle in Settings. When active: set `transition-duration: 0s` globally, cancel all `@keyframes` animations, pause the visualizer, disable crossfade transitions (jump-cut instead). Implement via a CSS class on `<html>` and by checking a Zustand store flag in animation-heavy components.
- **Touch targets:** All buttons in the mobile UI must have `min-width: 44px; min-height: 44px`. If the visual button is smaller, add invisible padding: `padding: 12px; margin: -12px;`. Use a Storybook accessibility addon or manual audit to verify touch target sizes.
- **Font size scaling:** Use `rem` units throughout for all text. Define `font-size` on `<html>` as `62.5%` (so `1rem = 10px`). Respect the OS accessibility font size setting via CSS `env(safe-area-inset-*)` and by not overriding `font-size` on `<html>` with a fixed `px` value — let the browser inherit the user's system preference.

---

### 19.4 Hearing Accessibility

**What it does:**
- Subtitles always easily accessible for video. Waveform as a visual audio alternative. BPM display for rhythm tracking.

**Implementation Notes:**

- **Subtitle button prominence:** The "CC" button in the video control bar is always visible and is never hidden behind a submenu. Keyboard shortcut `C` toggles subtitles.
- **BPM display:** In the track info section of the Now Playing view, show BPM as a large number alongside a small animated metronome icon that blinks at the detected BPM. Users who rely on visual rhythm tracking can use this to stay in sync with music. The metronome animation is a CSS `@keyframes` pulse with interval set via `animation-duration: ${60000 / bpm}ms`.

---

## 20. Personalization & Themes

---

### 20.1 Themes

**What it does:**
- Built-in themes: Dark, Light, AMOLED Black, High Contrast. Follows OS dark/light mode automatically. Accent color picker: 12 presets + custom hex.

**Implementation Notes:**

- **CSS variables architecture:** Define all colors as CSS variables on `:root`. Each theme overrides these variables by applying a class to `<html>`:
  ```css
  html.dark { --bg-primary: #1a1a1a; --text-primary: #f0f0f0; ... }
  html.amoled { --bg-primary: #000000; ... }
  html.light { --bg-primary: #ffffff; --text-primary: #111111; ... }
  ```
- **OS theme follow:** Use `window.matchMedia('(prefers-color-scheme: dark)')`. Add a `change` listener and update the theme class on `<html>`. When the user has chosen "System" in Settings, this auto-switch is active.
- **Accent color:** Define `--accent-color` as a CSS variable. The 12 presets are hardcoded hex values. Custom hex input: validate that it's a valid 6-digit hex, then set `document.documentElement.style.setProperty('--accent-color', '#'+hex)`. Store in settings.

---

### 20.2 Dynamic Color (Adaptive Theming)

**What it does:**
- Extracts dominant and accent colors from the current track's album art. Uses them to tint the Now Playing background, progress bar, and visualizer with a smooth transition.

**Implementation Notes:**

- **Color extraction:** When a track loads, draw its cover art to a hidden `<canvas>`. Call a color quantization function (implement k-means clustering with k=3 in JavaScript, or use the `node-vibrant` library on the server side) to extract the 3 most prominent colors. Pick the most saturated non-white, non-black color as `dominantColor` and the most contrasting color as `accentColor`.
- **Application:** Set CSS variables: `--now-playing-bg: {dominantColor at 70% opacity}`, `--progress-color: {accentColor}`. Apply `transition: background-color 0.8s ease` on the Now Playing container so the color change is gradual (not a jarring flash) as tracks change.
- **Accessibility guard:** After extracting colors, check that text on the `dominantColor` background meets WCAG AA contrast (4.5:1). If not, lighten or darken the background color until it passes. Never use a background color that makes text unreadable.

---

### 20.3 Layout Preferences

**What it does:**
- Compact mode (denser grid), Cozy mode (larger covers), Wide layout (sidebar + full-width grid on desktop).

**Implementation Notes:**

- **CSS class switching:** Add a `data-layout` attribute to `<html>`: `html[data-layout='compact']` reduces `--grid-cell-size` and `--row-height` CSS variables. `html[data-layout='cozy']` increases them. `html[data-layout='wide']` shows the sidebar and uses a wider grid column count.
- **Wide layout:** On desktop (viewport width > 1200px), the sidebar nav (playlists, radio, podcasts) is always visible as a fixed-width left column (240px). On narrower viewports or in non-wide mode, it collapses into the hamburger menu.
- **Setting:** A segmented control in Settings → Appearance: "Compact | Default | Cozy | Wide." Store in settings table.

---

### 20.4 Home Screen Widgets

**What it does:**
- Customizable home screen cards: Mood Detector, Recently Played, Top Tracks, New Discoveries, Weekly Snapshot, Podcasts, Radio. Drag-to-reorder. Permanently hide any card.

**Implementation Notes:**

- **Widget registry:** Define a list of widget IDs: `['mood_detector', 'recently_played', 'top_tracks', 'new_discoveries', 'weekly_snapshot', 'podcasts', 'radio']`. Store user's widget order and visibility as a JSON array in settings: `[{id, visible, order}]`.
- **Home rendering:** The home screen maps over the ordered, visible widget list and renders each widget component. Each widget is a self-contained component that fetches its own data (memoized).
- **Drag-to-reorder:** Use `@dnd-kit/sortable` on the home screen widget list. On reorder, persist the new order to settings.
- **Hide:** Each widget has a "×" button (only visible in a "Customize Home" edit mode, toggled via a pencil icon in the header). Clicking hides the widget (`visible: false`). A separate "Show hidden widgets" section in the customize panel lists hidden widgets with a "Show" button for each.

---

### 20.5 Custom Keyboard Shortcuts (Desktop)

**What it does:**
- Remap any keybinding in Settings. Export and import shortcut profiles.

**Implementation Notes:**

- **Shortcut registry:** Define all shortcuts as a `Record<string, string>` where keys are action IDs (e.g., `'playPause'`, `'nextTrack'`) and values are key strings (e.g., `'Space'`, `'N'`). Store the current mapping in the settings table as a JSON blob.
- **Custom shortcut capture:** In the shortcut settings panel, each row shows the action name, current key, and a "Change" button. Clicking "Change" activates a capture mode: `keydown` event is captured for the next keypress, the key string is recorded, duplicate-checked against other actions, and saved.
- **Export/import:** Export the shortcut JSON as a `.json` file download. Import by uploading a `.json` file, validating its structure, and merging into the current settings.

---

---

# 🏃 Sprint 11 — Performance & Platform-Specific

> **Goal:** Hit all hard performance targets, implement the worker thread architecture and Low Power Mode, then build out every platform-specific surface: Tauri desktop, Capacitor mobile, and PWA.

---

## 21. Performance & Resource Awareness

---

### 21.1 Performance Targets (Hard Requirements)

| Metric | Target |
|--------|--------|
| Native desktop: library grid first paint | < 200ms from app launch |
| Web: first 20 tracks rendered | < 500ms after folder permission grant |
| 10,000-track re-scan (no changes) | < 100ms |
| Search results (100,000 tracks) | < 50ms |
| Max DOM nodes in any scroll list | 60 |
| Visualizer frame rate | 60fps when `hardwareConcurrency >= 4` |

**Implementation Notes:**

- **200ms desktop first paint:** The Tauri app shell (HTML + JS bundle) is embedded in the binary. No network fetch needed. Pre-load the SQLite DB connection on app start in the Rust layer before the frontend even requests it. The first `GET /api/tracks?limit=20` call should return from the pre-warmed DB in < 50ms. The remaining 150ms is React rendering. Lazy-load all non-critical modules (EQ panel, stats dashboard, etc.) to keep the initial JS bundle small.
- **< 100ms re-scan:** The scan pipeline compares `mtime + file_size` against the `scan_cache` table. This query: `SELECT path, mtime, file_size FROM scan_cache` is a full table scan on a table with an index on `path`. For 10,000 rows, this runs in < 5ms. The filesystem stat call for 10,000 files with no changes takes ~80ms on macOS SSD. Total: well under 100ms.
- **< 50ms search:** SQLite FTS5 full-text search on 100,000 rows returns in < 20ms. The additional join and result formatting adds ~10ms. Total < 30ms. Add `PRAGMA cache_size = -64000` (64MB SQLite cache) and `PRAGMA journal_mode = WAL` to maximize query performance.

---

### 21.2 Worker Thread Architecture

**What it does:**
- Any operation taking over 16ms runs in a worker thread. Zero blocking on the main thread. Workers communicate via `BroadcastChannel`. Background audio analysis runs between files without CPU spikes.

**Implementation Notes:**

- **Node.js workers:** Use `worker_threads` module for all heavy server-side operations: library scanning, audio analysis, fingerprinting, duplicate detection, waveform computation. Each worker is a separate `.ts` file compiled to JS. The main server thread manages a worker pool (max 4 workers, configurable).
- **Web Workers:** For web/PWA, run audio analysis in a `Worker` (browser). Use `Comlink` (a TypeScript library) to make worker function calls look like async function calls from the main thread. The waveform computation and BPM detection logic are compiled to WASM for performance in the browser worker.
- **BroadcastChannel:** Workers post progress events to a `BroadcastChannel('zovyra-workers')`. Any listener (main thread, other workers, or the frontend via Socket.IO bridge) can subscribe to these events for progress updates.
- **`setImmediate` between files:** In the scan loop: `for (const file of files) { await analyzeFile(file); await new Promise(resolve => setImmediate(resolve)); }`. The `setImmediate` yields control back to the event loop between each file, allowing incoming HTTP requests (e.g., play commands) to be handled without waiting for the entire scan to finish.

---

### 21.3 Low Power Mode

**What it does:**
- Automatically activates on low battery, weak hardware, or FPS drops. Reduces visualizer, waveform resolution, and background work. Exits when conditions improve.

**Implementation Notes:**

- **Trigger conditions (check on app start and periodically every 60s):**
  1. Battery: `navigator.getBattery().then(b => b.level < 0.2 && !b.charging)` → activate.
  2. Hardware: `navigator.hardwareConcurrency <= 2 || navigator.deviceMemory <= 1` → activate permanently (device is always weak).
  3. FPS: Run an FPS monitor using a `requestAnimationFrame` loop that counts frames per second. If `fps < 20` for two consecutive 2-second windows → activate.
- **Effects when active:**
  - Cancel the visualizer RAF loop (`cancelAnimationFrame(visualizerRafId)`).
  - Set `waveformPeaks = 250` (instead of 300) on the next waveform render.
  - Post a message to background analysis workers: `worker.postMessage({type: 'pause'})`.
  - Throttle lazy-loaded cover art: increase `IntersectionObserver` root margin to 0px (only load art when actually visible, not from pre-loading).
- **Exit condition:** FPS > 40fps for two consecutive 2-second windows AND battery > 20% (or charging). Reverse all effects.
- **`useLowPowerMode()` hook:** A React hook that subscribes to the Zustand store's `lowPowerMode` boolean. Any component can call `const isLowPower = useLowPowerMode()` and conditionally render cheaper alternatives.

---

### 21.4 Background Tab Optimization

**What it does:**
- When the tab is hidden, all animation RAF loops stop. Audio continues uninterrupted. Loops resume when the tab is visible again.

**Implementation Notes:**

- **`visibilitychange` listener:** `document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseAllRafLoops(); } else { resumeAllRafLoops(); } })`.
- **RAF loop registry:** Maintain a `Set<number>` of active RAF loop IDs in a global registry. `pauseAllRafLoops()` calls `cancelAnimationFrame` on each ID and stores the loop restart functions. `resumeAllRafLoops()` calls each restart function. The audio `AudioContext` is not suspended — it runs in a dedicated audio thread unaffected by the JS main thread's RAF pausing.
- **Audio context on mobile:** On iOS, audio stops when the screen locks unless the app registers as a background audio player. For the web PWA on iOS, use the `MediaSession` API to tell iOS that this is a media player, which grants background audio permission. On Capacitor iOS, configure `AVAudioSession` with `category: .playback` to maintain audio during screen lock and silent switch.

---

### 21.5 Cover Art Pipeline

**What it does:**
- Cover art is never stored as BLOBs in SQLite. Stored as files on disk (desktop) or as object URLs from IndexedDB (web). Fast in-memory lookup cache.

**Implementation Notes:**

- **Desktop storage:** When cover art is extracted from a file's tag at scan time (Rust reads the embedded JPEG bytes), write it to `~/.zovyra/covers/{trackId}.jpg`. The `tracks` table stores `cover_art_path TEXT` pointing to this file. The frontend requests `GET /api/covers/{trackId}` which serves the file with a 1-year `Cache-Control` header.
- **Web/PWA storage:** Store cover art JPEG bytes in IndexedDB using `idb` library (`db.put('covers', jpegBlob, trackId)`). On retrieval, call `URL.createObjectURL(jpegBlob)` and use the resulting object URL as the `<img src>`. Store the object URLs in an in-memory `Map<trackId, objectUrl>` so they don't need to be regenerated on every render.
- **In-memory map:** `const coverCache = new Map<number, string>()`. On cover art request, check the map first. On cache miss, fetch from disk (desktop) or IndexedDB (web), create the object URL, and add to the map. The map acts as an L1 cache — cover art for recently viewed tracks is served from memory in < 1ms.
- **Never SQLite BLOBs:** SQLite BLOBs for cover art cause the database file to balloon in size and slow all queries. The file-on-disk approach keeps the DB small and fast.

---

## 22. Desktop-Specific Features (Tauri)

---

### 22.1 System Tray

**What it does:**
- App stays alive in the system tray when the window is closed. Tray menu includes media controls and now-playing info. Icon animates during playback.

**Implementation Notes:**

- **Tauri tray:** Configure in `tauri.conf.json`: `"systemTray": {"iconPath": "icons/tray.png", "iconAsTemplate": true}`. In the Rust `main.rs`, handle the `on_system_tray_event` callback. Build the tray menu using `SystemTrayMenu::new()` with `CustomMenuItem` entries for each action.
- **`CloseRequested` event:** Listen to the window's `close_requested` event. Instead of allowing the window to close, call `window.hide()`. This keeps the app running in the background.
- **Tray menu items:** "Show ZOVYRA" (shows the window), separator, "▶ Play / ⏸ Pause" (toggles play, label updates dynamically), "⏭ Next", "⏮ Previous", separator, a disabled label showing the current track title + artist (grayed out, not clickable), separator, "Quit."
- **Animated tray icon:** Ship two icon files: `tray_playing.png` and `tray_paused.png`. In the Rust playback event handler, call `app.tray_handle().set_icon(Icon::File(path))` to swap icons. On macOS, use template images (black & transparent) so the tray icon adapts to dark/light menu bar automatically.

---

### 22.2 Global Media Keys

**What it does:**
- Play/Pause, Next, Previous, Stop work even when the app is backgrounded, via OS media key hooks.

**Implementation Notes:**

- **Tauri plugin:** Use `tauri-plugin-global-shortcut` or the `media-keys` Rust crate. Register global shortcuts for: `MediaPlayPause`, `MediaNextTrack`, `MediaPrevTrack`, `MediaStop`. On key press, send a Tauri event to the frontend: `app.emit_all('media-key', {key: 'play-pause'})`. The frontend's playback engine listens for these events and calls the appropriate methods.
- **macOS:** Media keys work automatically via the `RemoteCommandCenter` API in Swift/ObjC. In a Tauri app, use a Swift helper plugin or the `command-center` crate.
- **Windows:** Register raw input hooks for HID consumer control codes via the Win32 API or use the `media-keys` crate which handles this.

---

### 22.3 First-Launch Setup

**What it does:**
- A setup wizard on first launch lets users choose to scan their entire computer or pick specific folders. Scanning begins immediately and tracks appear in the grid in real time.

**Implementation Notes:**

- **First launch detection:** Check for the absence of any rows in the `scan_cache` table on app start. If empty, show the setup wizard instead of the main library view.
- **"Scan My Entire Computer" option:** On macOS, scan `~/Music`, `~/Movies`, and `~/Downloads`. On Windows, scan the user's Music, Videos, and Downloads folders (from environment variables). On Linux, scan `~/Music`, `~/Videos`. Show a warning: "This may take a few minutes for large collections."
- **"Choose Folders" option:** Open a multi-folder picker dialog via Tauri's `dialog::open()` with `directory: true, multiple: true`. Pass the selected paths to the scan service.
- **Live progress view:** Don't wait for the wizard to show the library. Navigate to the main library view immediately after folder selection, with a progress bar at the top and tracks populating the grid in real time via Socket.IO `library:scan:progress` events.

---

### 22.4 File Association

**What it does:**
- ZOVYRA registers as the default handler for audio and video file types. Double-clicking a file in Finder/Explorer opens it in ZOVYRA.

**Implementation Notes:**

- **macOS:** In `Info.plist` (embedded in the Tauri app bundle), register `CFBundleDocumentTypes` with all supported audio and video UTIs (e.g., `public.mp3`, `public.flac`, `public.mpeg-4`, `public.avi`, etc.). On launch with a file argument, Tauri's `open_url` event fires with the file path.
- **Windows:** Register file type associations in the Windows registry via the Tauri installer (NSIS or WiX). The installer adds registry keys under `HKEY_CLASSES_ROOT\.mp3`, `.flac`, etc., pointing to ZOVYRA's executable with the file path as an argument.
- **Handling the open event:** In `main.rs`, listen for `RunEvent::OpenUrls` (macOS) or check `std::env::args()` for a file path argument (Windows). Pass the file path to the frontend via `window.emit('open-file', {path})`. The frontend adds it to the queue and begins playback.

---

### 22.5 Native Notifications

**What it does:**
- Track change, download complete, and new podcast episode notifications. Configurable: always / on album change / never.

**Implementation Notes:**

- **Tauri notifications:** Use `tauri::api::notification::Notification::new(&app.config().tauri.bundle.identifier).title("Now Playing").body("{artist} — {title}").icon("path/to/cover.jpg").show()`. On macOS, this uses the native `NSUserNotification` or `UNUserNotificationCenter`. On Windows, it uses the Windows Toast notification API.
- **Track change setting:** In Settings → Notifications, a segmented control: "Every track | On album change | Never." "On album change" only shows a notification when `nextTrack.album !== currentTrack.album`. Store in settings.
- **Download complete:** Show a notification when a download finishes: "Downloaded: {track title}." Include an "Open" action button that navigates to the track in the library.
- **New episodes:** When the podcast refresh job finds new episodes, show: "New episode of {Podcast Name}: '{Episode Title}'."

---

### 22.6 Mini Window Mode

**What it does:**
- A compact always-on-top floating player window (320×80px) with cover art, title, play/pause, prev, next, and seek bar. Toggle between full app and mini window.

**Implementation Notes:**

- **Tauri second window:** Create a second `Window` in `tauri.conf.json` or programmatically via `tauri::WindowBuilder::new(app, "mini", tauri::WindowUrl::App("mini.html".into()))`. Configure it: `always_on_top: true`, `decorations: false` (no title bar), `width: 320, height: 80`, `resizable: false`, `skip_taskbar: true`.
- **Mini player UI:** A separate `mini.html` page (loaded in the mini window) that renders: a 40×40px cover art thumbnail, a scrolling track title/artist marquee, play/pause, prev, next buttons, and a thin seek bar. All commands are sent to the main window via Tauri's event system (`window.emit('playback-command', {...})`).
- **Toggle shortcut:** `Cmd/Ctrl+Shift+M` toggles between showing the main window (and hiding the mini window) and showing the mini window (and hiding the main window but keeping it running).

---

### 22.7 Hardware Codec Probing

**What it does:**
- On startup, probes which codecs have hardware acceleration available. Displays the results in Settings → About.

**Implementation Notes:**

- **Probe method:** For each supported codec (H.264, HEVC, AV1, VP9), attempt to create a minimal hardware-accelerated decode context in Rust using the FFmpeg `avcodec_find_decoder_by_name` function with the hwaccel variant (e.g., `h264_videotoolbox` on macOS, `h264_dxva2` on Windows). If the decoder initializes without error, mark it as hardware-supported. Cache the result in settings (run once on first launch, not on every startup — results don't change unless the user switches hardware).
- **Settings display:** In Settings → About, a "Hardware Acceleration" section lists each codec and its status: "H.264: ✅ Hardware (VideoToolbox) | HEVC: ✅ Hardware | AV1: ⚠️ Software | VP9: ✅ Hardware."

---

## 23. Mobile-Specific Features (Capacitor)

---

### 23.1 Background Audio

**What it does:**
- Audio continues playing when the screen is locked. iOS uses `AVAudioSession`. Android uses a Foreground Service.

**Implementation Notes:**

- **iOS:** In the Capacitor app's `AppDelegate.swift`, configure `AVAudioSession`: `try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)`. This allows audio to play when the app is backgrounded or the screen is locked. Set `UIBackgroundModes: audio` in `Info.plist`.
- **Android:** Create a `MediaPlaybackService` extending `MediaBrowserServiceCompat`. Start it as a foreground service when playback begins: `startForeground(NOTIFICATION_ID, buildNotification())`. The notification must include playback controls. Stop the foreground service when playback stops. Register the service in `AndroidManifest.xml` with `FOREGROUND_SERVICE` permission.
- **Capacitor bridge:** Use the `@capacitor-community/background-runner` plugin or a custom Capacitor plugin to bridge JavaScript playback commands to the native service.

---

### 23.2 Lock Screen / Notification Controls

**What it does:**
- Album art, title, and artist on the lock screen and notification shade. Play/pause, next, previous, and seek controls from the lock screen.

**Implementation Notes:**

- **Web (Media Session API):** Set `navigator.mediaSession.metadata = new MediaMetadata({title, artist, album, artwork: [{src: coverUrl, sizes: '512x512'}]})`. Register action handlers: `navigator.mediaSession.setActionHandler('play', play)`, `'pause'`, `'nexttrack'`, `'previoustrack'`, `'seekto'`. The browser propagates these to the OS lock screen (works in Chrome on Android, Safari on iOS).
- **Native (Capacitor Android):** The Foreground Service's notification uses a `MediaStyle` notification with `addAction` for prev/play-pause/next. Build the notification using `NotificationCompat.Builder` with `setStyle(new MediaStyle().setMediaSession(mediaSession.getSessionToken()))`.
- **Native (Capacitor iOS):** Configure `MPNowPlayingInfoCenter.default().nowPlayingInfo` with the track's metadata dictionary. Configure `MPRemoteCommandCenter.shared()` with target/action pairs for each control.

---

### 23.3 Gesture Controls (Video)

**What it does:**
- Horizontal swipe = seek. Left half vertical swipe = brightness. Right half vertical swipe = volume. Pinch to zoom. Double-tap edges = seek ±10s.

**Implementation Notes:** Already covered in §3.2. On Capacitor, use the native gesture APIs via a Capacitor plugin for more reliable gesture detection than Hammer.js. The `@capacitor/haptics` plugin adds haptic feedback on gesture recognition.

---

### 23.4 Offline Downloads (Mobile)

**What it does:**
- Downloads stored in app-private storage. Storage usage visible per category. Low-storage warning at < 500MB free.

**Implementation Notes:**

- **Storage path:** Use `Filesystem.getUri({path: '', directory: Directory.Data})` from `@capacitor/filesystem` to get the app's private data directory. Store all downloads under `{dataDir}/zovyra/downloads/`.
- **Low storage warning:** Check available storage using `StorageInfo` from `@capacitor/filesystem`. If `free < 500 * 1024 * 1024` (500MB), show a persistent banner: "⚠ Low storage — Clear downloads to free space." Include a "Manage Storage" button that navigates to Settings → Storage.

---

### 23.5 Widget (iOS / Android)

**What it does:**
- A home screen widget showing the currently playing track with play/pause and skip controls. Small (2×2) and medium (4×2) sizes.

**Implementation Notes:**

- **iOS:** Implement a WidgetKit extension in Swift. The widget reads the current playing track from an App Group shared `UserDefaults` (the main app writes track info there on every track change). The widget displays the cover art, title, artist, and three buttons (prev/play-pause/next) using `Intent` configurations. Buttons use a `URLScheme` (`zovyra://widget?action=next`) which the main app handles via `onOpenURL`.
- **Android:** Implement an `AppWidget` extending `AppWidgetProvider`. Use `RemoteViews` to build the UI. Buttons send `PendingIntent` broadcasts caught by a `BroadcastReceiver` in the app. The widget updates via `AppWidgetManager.updateAppWidget()` called from the Foreground Service on every track change.

---

### 23.6 CarPlay / Android Auto

**What it does:**
- Audio playback controls exposed to the car head unit. Queue is browsable from the car screen. No video on car screens.

**Implementation Notes:**

- **CarPlay (iOS):** Implement the `MPPlayableContentDataSource` and `MPPlayableContentDelegate` protocols in the Capacitor iOS native layer. Provide a content tree: Library → Artists → Albums → Tracks, and Playlists → [Playlist Name] → Tracks. The car screen renders these automatically using Apple's templates.
- **Android Auto:** Implement `MediaBrowserServiceCompat` (already needed for background audio). Android Auto uses the Media Browser protocol to browse the content tree. The app's `MediaBrowserServiceCompat.onGetRoot()` and `onLoadChildren()` methods provide the content hierarchy. Playback commands come via the `MediaSession` callback.
- **Video restriction:** In CarPlay/Android Auto content providers, never include video files in the content tree. Filter to audio-only (`mime LIKE 'audio/%'`) in all Car content queries.

---

### 23.7 Haptic Feedback

**What it does:**
- Subtle haptic pulses on track start, like/rate actions, and save actions. Configurable.

**Implementation Notes:**

- **`@capacitor/haptics`:** `Haptics.impact({style: ImpactStyle.Light})` on track start. `Haptics.notification({type: NotificationType.Success})` on save/like actions. `Haptics.impact({style: ImpactStyle.Medium})` on rate action.
- **Web fallback:** The browser's Vibration API: `navigator.vibrate(10)` for a very short pulse. Not as nuanced as native haptics but provides some feedback.
- **Setting:** "Haptic Feedback" toggle in Settings → General (default on). Store in settings. All haptic calls check this setting before firing.

---

## 24. PWA / Web-Specific Features

---

### 24.1 Installable PWA

**What it does:**
- A `manifest.json` enabling the app to be installed to the home screen on any platform via the browser.

**Implementation Notes:**

- **`manifest.json`:**
  ```json
  {
    "name": "ZOVYRA",
    "short_name": "ZOVYRA",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#1a1a1a",
    "theme_color": "#1a1a1a",
    "icons": [
      {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
      {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
      {"src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
    ]
  }
  ```
- **Install prompt:** Listen for the `beforeinstallprompt` event. Stash the event and show a custom "Install App" button in the UI (don't rely on the browser's default prompt). When the user clicks the button, call `stashedEvent.prompt()`. After the prompt, listen to `userChoice` and react accordingly.
- **Standalone mode detection:** `window.matchMedia('(display-mode: standalone)').matches`. When true, hide any "Install App" prompts and apply standalone-specific UI adjustments (e.g., account for iOS safe area insets with `env(safe-area-inset-*)`).

---

### 24.2 File System Access API

**What it does:**
- Users grant folder access once via `showDirectoryPicker()`. The `FileSystemDirectoryHandle` is stored in IndexedDB and persists across sessions. Files are processed with periodic yields to keep the UI responsive.

**Implementation Notes:**

- **Handle persistence:** `showDirectoryPicker()` returns a `FileSystemDirectoryHandle`. Serialize it to IndexedDB using the `idb` library: `await db.put('handles', handle, 'music-folder')`. On subsequent sessions, retrieve it: `const handle = await db.get('handles', 'music-folder')`. Check permission: `await handle.queryPermission({mode: 'read'})`. If `'granted'`, proceed without re-prompting. If `'prompt'`, call `await handle.requestPermission({mode: 'read'})`.
- **Recursive scanning:** Use an async generator to recursively traverse the directory handle: `async function* walkDir(handle) { for await (const [name, entry] of handle) { if (entry.kind === 'file') yield entry; else yield* walkDir(entry); } }`. Iterate this generator and process each file.
- **Yield between files:** `for await (const fileHandle of walkDir(rootHandle)) { await processFile(fileHandle); await new Promise(r => setTimeout(r, 0)); // yield }`. The `setTimeout(r, 0)` allows browser rendering between file processing.

---

### 24.3 Service Worker / Offline Caching

**What it does:**
- The app shell loads offline. Track metadata is served from IndexedDB. Cover art from cached object URLs. An offline indicator in the header.

**Implementation Notes:**

- **Workbox:** Use Workbox (Google's service worker library) for caching strategies. Configure in `vite-plugin-pwa` or a manual Workbox service worker:
  - `precacheAndRoute([...appShellAssets])` — caches all JS/CSS/HTML at install time.
  - `registerRoute(/\/api\/tracks/, new NetworkFirst({cacheName: 'api-tracks', networkTimeoutSeconds: 3}))` — tries network first, falls back to cache.
  - `registerRoute(/\/api\/covers/, new CacheFirst({cacheName: 'cover-art', plugins: [new ExpirationPlugin({maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60})]}))` — covers are served from cache (they never change).
- **Offline indicator:** `window.addEventListener('offline', () => store.set('isOffline', true))`. A `<div>` in the header shows "● Offline" in amber when `isOffline` is true.

---

### 24.4 Background Sync (Web)

**What it does:**
- Stats events buffered locally and replayed when connectivity is restored. Podcast feed refresh deferred to Background Sync if offline.

**Implementation Notes:**

- **Service Worker Background Sync:** Register sync tags from the main thread: `await navigator.serviceWorker.ready.then(reg => reg.sync.register('sync-stats'))`. In the service worker, listen for `sync` events: `self.addEventListener('sync', event => { if (event.tag === 'sync-stats') event.waitUntil(syncStats()); })`. The `syncStats()` function reads buffered events from IndexedDB and sends them to the server API.
- **Buffering:** When a stats API call fails (offline), write the event to an `offline_queue` IndexedDB store. The Background Sync handler processes this queue when connectivity is restored.

---

### 24.5 Web Share API

**What it does:**
- "Share" on tracks and playlists uses the native Web Share API on mobile. Falls back to clipboard copy on desktop.

**Implementation Notes:**

- **Detection:** `const canShare = navigator.share !== undefined && navigator.canShare !== undefined`. On mobile Chrome/Safari, `canShare` is true.
- **Sharing:** `await navigator.share({title: trackTitle, text: `${artist} — ${title}`, url: deepLink})`. On desktop fallback: `await navigator.clipboard.writeText(deepLink)` and show a toast "Link copied to clipboard."
- **File sharing (Now Playing card):** `await navigator.share({files: [imageFile], title: 'My Now Playing'})`. Check `navigator.canShare({files: [imageFile]})` before attempting — not all browsers support file sharing even when they support URL sharing.

---

---

# 🏃 Sprint 12 — Security, Power Users & Onboarding

> **Goal:** Harden the security and privacy posture, ship the full power-user toolkit, and polish the onboarding experience to zero friction.

---

## 25. Security & Privacy

---

### 25.1 Local-First Architecture

**What it does:**
- No mandatory cloud account. All data on the user's device. No telemetry by default. External API calls are opt-in and clearly labeled.

**Implementation Notes:**

- **No account flow:** The app never shows a sign-in screen. The first-run experience goes directly to folder selection. There is no "Create account" or "Log in" button anywhere in the app.
- **Telemetry opt-in:** There is no telemetry code in ZOVYRA. Not opt-out — simply absent. External API calls (AcoustID, MusicBrainz, LRCLIB, LibreTranslate, Radio Browser) are listed in Settings → Privacy with a toggle for each. When a toggle is off, all code paths that call that API are short-circuited and return null.
- **Privacy settings page:** A dedicated Settings → Privacy section: "External services — Toggle any service off to prevent ZOVYRA from contacting it." Each entry shows the service name, what data is sent, and a link to the service's privacy policy.

---

### 25.2 Data Handling

**What it does:**
- All external API calls have an 8-second timeout and send only the minimum required data. No user IDs sent to any service.

**Implementation Notes:**

- **Timeout enforcement:** Wrap every external `fetch()` call with `AbortController`: `const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 8000); fetch(url, {signal: ctrl.signal})`.
- **Minimum data principles:**
  - AcoustID: sends `fingerprint` (computed from audio) and `duration`. Nothing else.
  - LRCLIB: sends `artist_name`, `track_name`, `duration`. No user ID, no device ID.
  - MusicBrainz: sends track/artist name for search. No user data.
  - LibreTranslate: sends the lyrics text. No user data.
  - Radio Browser: sends search terms (genre, country, name). No user data.
- **Code review checklist:** Before any release, audit all external API calls for accidental data leakage (e.g., accidentally including the device ID or IP address in a request body).

---

### 25.3 API Key Management (Desktop)

**What it does:**
- User-provided API keys (AcoustID, LibreTranslate self-host URL) stored in the OS keychain, not in plain text.

**Implementation Notes:**

- **Tauri secure storage:** Use the `tauri-plugin-stronghold` plugin or the OS keychain directly via a Tauri command. In Rust: use the `keyring` crate to store/retrieve secrets: `keyring::Entry::new("zovyra", "acoustid_key").set_password(key)`. On macOS, this writes to the macOS Keychain. On Windows, to the Windows Credential Manager. On Linux, to libsecret/GNOME Keyring.
- **Settings UI:** In Settings → API Keys, show a masked input field for each key (e.g., "AcoustID API Key: [••••••••••••] [Edit]"). Clicking Edit shows the input for the new key. On save, call the Tauri keychain write command. Never display the stored key in full after it has been saved.

---

### 25.4 Sandboxed File Access

**What it does:**
- On web, only files within the user-granted folder are accessible. No arbitrary path access.

**Implementation Notes:**

- **File System Access API enforcement:** All file reads go through `FileSystemDirectoryHandle` and `FileSystemFileHandle` objects — the browser's sandboxed API. The app never constructs arbitrary file paths from user input. The Rust tag writer on desktop only operates on `file_path` values that exist in the `tracks` table (which only gets populated by the folder scanner).
- **Tauri file access scope:** Configure `tauri.conf.json` to restrict file access: `"fs": {"scope": ["$APPDATA/**", "$HOME/Music/**", "$HOME/Movies/**"]}`. Tauri will block any file read/write outside these paths.

---

### 25.5 No DRM

**What it does:**
- ZOVYRA plays locally-owned files only. No DRM enforcement. Files cannot be expired or locked remotely.

**Implementation Notes:**

- **No DRM code:** ZOVYRA contains zero DRM decryption code (no Widevine, no FairPlay, no PlayReady integration). This is enforced by the absence of such code, not by a settings toggle.
- **User communication:** In Settings → About, include a clear statement: "ZOVYRA plays your files. We have no ability to remotely lock, expire, or restrict access to your locally stored media."

---

## 26. Power User & Pro Features

---

### 26.1 Command Palette

**What it does:**
- `Cmd/Ctrl+K` opens a fuzzy-searchable command palette covering tracks, playlists, settings, and navigation.

**Implementation Notes:**

- **UI:** A modal overlay with a full-width text input at the top and a scrollable results list below. Appears with a subtle scale-up + fade-in animation. Closes on `Escape` or click outside.
- **Data sources:** On first open, index: all track titles and artists (from the DB, limit 500 for performance), all playlist names, all settings section names and toggle labels, all navigation routes. Store this index in memory as an array of `{label, subtitle, action, icon}` objects.
- **Fuzzy matching:** Use `fuse.js` with `{threshold: 0.4, keys: ['label', 'subtitle']}` to rank results. Show the top 8 results. Highlight the matched characters in the result labels using the matched indices returned by Fuse.js.
- **Actions:** Each result has an `action` function. For a track: `() => playTrack(trackId)`. For a playlist: `() => navigate('/playlist/' + id)`. For a setting: `() => navigate('/settings#' + anchor)`. For a toggle: `() => toggleSetting(settingKey)`.
- **Keyboard navigation:** `↑` / `↓` move selection. `Enter` executes the selected result's action. `Tab` auto-completes the selected result's label into the input for refinement.

---

### 26.2 Batch Operations

**What it does:**
- Multi-select tracks and apply bulk actions: add to playlist, rate, re-scan metadata, export tags, delete. Progress bar for long operations.

**Implementation Notes:**

- **Multi-select state:** When 1+ tracks are selected (via Shift+click or Ctrl+click in the library grid), a floating action bar appears at the bottom of the screen: "N selected | [Add to Playlist ▾] [Rate ▾] [Re-scan] [Export Tags] [Delete]."
- **Bulk add to playlist:** Opens a playlist picker. On confirm, calls `POST /api/playlists/{id}/tracks` with the array of track IDs. The API processes in a single SQL `INSERT INTO playlist_tracks SELECT ? FROM ... WHERE NOT EXISTS ...` to avoid duplicates.
- **Re-scan metadata:** `POST /api/tracks/rescan` with `{trackIds: [...]}`. The server re-reads tags and analysis from each file sequentially. Emits progress events. Results are reflected in the library grid immediately.
- **Export tags:** Generates a CSV or JSON file with all tag fields for the selected tracks. Triggers a download.
- **Progress bar:** A modal with a `<progress>` element and a cancel button. The backend emits progress events via Socket.IO. On cancel, the server stops processing further items (does not undo already-processed ones).

---

### 26.3 Library Audit Tools

**What it does:**
- Panels for: Missing Files (with relocate option), Untagged Tracks, Low Bitrate Files, No Cover Art, Duplicate Groups.

**Implementation Notes:**

- **Missing Files:** `SELECT * FROM tracks WHERE missing = 1`. Each row shows the last known path and a "Locate File" button that opens a file picker. On file selection, update the `file_path` and `missing = 0` in the DB, and verify the new path's fingerprint matches (optional: AcoustID check).
- **Untagged Tracks:** `SELECT * FROM tracks WHERE title IS NULL OR title = '' OR artist IS NULL OR artist = ''`. Show a "Fix Tags" button that opens the metadata editor for each track.
- **Low Bitrate Files:** A threshold input (default 128 kbps). `SELECT * FROM tracks WHERE bitrate < ? ORDER BY bitrate ASC`. Display the actual bitrate next to each track.
- **No Cover Art:** `SELECT * FROM tracks WHERE cover_art_path IS NULL GROUP BY album_artist, album`. Shows one row per album (not per track). A "Fetch Art" button triggers the bulk cover art fetch (§18.4) for just that album.
- **Duplicate Groups:** Already covered in §4.7. This audit panel is the entry point to the duplicate detection UI.

---

### 26.4 Audio Graph Inspector (Dev Mode)

**What it does:**
- A hidden developer tool showing the live audio processing graph as a node diagram with real-time values.

**Implementation Notes:**

- **Toggle:** A hidden setting in Settings → About, accessible by clicking the version number 5 times rapidly (easter egg activation pattern). Sets `devMode: true` in settings.
- **Graph rendering:** When dev mode is active, show a floating panel (or a `/dev/audio-graph` route) that renders the audio node graph as an SVG diagram. Nodes: Source → ReplayGain → EQ (5 nodes) → Compressor → Spatial → Stereo Widener → Master Gain → Destination. Each node shows its current gain value (from `.gain.value` or `.reduction`) updated via a `setInterval` at 100ms. Draw the connections as SVG lines between boxes.
- **Use case:** Helps diagnose audio issues — e.g., if the sound is too quiet, inspect which node has an unexpectedly low gain value.

---

### 26.5 Export Play History

**What it does:**
- Exports all playback events as a CSV file: track, timestamp, seconds played, completed, source.

**Implementation Notes:**

- **Endpoint:** `GET /api/stats/export?format=csv`. The server runs `SELECT ph.played_at, t.title, t.artist, t.album, ph.seconds_played, ph.completed, ph.source FROM playback_history ph JOIN tracks t ON t.id = ph.track_id ORDER BY ph.played_at ASC`. Convert to CSV using `csv-stringify`. Stream the response with `Content-Disposition: attachment; filename="zovyra_play_history.csv"`.
- **Use case:** Users can import this into Last.fm (via third-party scrobblers), analyze in Excel, or use it with tools like `MusicBrainz Picard` for library analysis.

---

### 26.6 Custom Themes via CSS Variables

**What it does:**
- Advanced users can override any CSS color variable. Themes export/import as JSON color maps.

**Implementation Notes:**

- **Settings panel:** A "Custom Theme" section in Settings → Appearance (collapsed by default, expandable). Shows a color picker for each CSS variable: `--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--accent-color`, `--border-color`, etc. (document all ~15 theme variables).
- **Live preview:** On any color change, immediately update `document.documentElement.style.setProperty('--var-name', value)`. The app theme updates in real time.
- **Export:** A "Export Theme" button downloads `{name: 'My Theme', colors: {--bg-primary: '#...', ...}}` as a JSON file.
- **Import:** "Import Theme" opens a file picker for a `.json` file. Validate that all expected variables are present, then apply.

---

### 26.7 Scripting Hooks (Desktop)

**What it does:**
- Configurable shell scripts or AppleScripts triggered on events: track change, scan complete, download complete. Enables integration with other tools.

**Implementation Notes:**

- **Configuration:** In Settings → Advanced → Scripting, a list of hooks: "On Track Change", "On Scan Complete", "On Download Complete." Each hook has a text field for the command/script path and a "Test" button.
- **Execution:** In the Rust layer, on each triggering event, call `std::process::Command::new("bash").arg("-c").arg(script).env("ZOVYRA_TRACK_TITLE", title).env("ZOVYRA_TRACK_ARTIST", artist)...spawn()`. On macOS, AppleScript is supported via `osascript`.
- **Security note:** Display a warning in the UI: "Scripts run with your user's full permissions. Only add scripts from trusted sources." Never run scripts without user-explicit configuration.

---

### 26.8 Operator Search Syntax

**What it does:**
- `field:value` operator search: `artist:Radiohead bpm:>120 energy:>0.7 year:2000..2010`. Documented in a help popover in the search bar.

**Implementation Notes:**

- **Parser:** Extract operator tokens with regex `/(\w+):(>=?|<=?)?([^\s]+)/g` before sending the remaining free text to FTS5. Map recognized fields to their SQL column names. Map operators to SQL operators. Construct a combined WHERE clause.
- **Range syntax:** `year:2000..2010` parses to `WHERE year >= 2000 AND year <= 2010`. Use `..` as the range delimiter.
- **Help popover:** A `?` button in the search bar opens a popover listing all supported field names, their types, and example queries: "bpm:>120 energy:>0.6 key:Am genre:Jazz year:2010..2020." Include a "Copy example" button next to each example.
- **Validation:** If the user types an unrecognized field name (e.g., `colour:blue`), show a yellow warning chip below the search input: "Unknown field: colour — did you mean genre?"

---

## 27. Onboarding & First-Run Experience

---

### 27.1 Setup Wizard

**What it does:**
- A 4-step wizard: (1) choose folders, (2) pick theme, (3) import playlists, (4) live scanning progress. Every step is skippable.

**Implementation Notes:**

- **Step tracking:** Store `onboarding_step INTEGER DEFAULT 0` in settings. On app start, if `onboarding_step < 4`, show the wizard at the appropriate step instead of the main library. Each "Next" click increments the step and persists it.
- **Step 1 — Folders:** See §22.3 (First-Launch Setup). On web, show the "Grant Folder Access" button. On desktop, show "Scan My Entire Computer" and "Choose Folders" options. Selecting folders immediately kicks off scanning in the background (do not block the wizard — advance to Step 2 right away).
- **Step 2 — Theme:** Show four large theme swatches (Dark, Light, AMOLED, High Contrast) and the accent color picker. The app background changes immediately to preview the selection. A "Skip" link in the top-right corner.
- **Step 3 — Import:** Buttons: "Import from iTunes/Apple Music," "Import M3U File," "Skip." Each triggers the appropriate import flow (§17.1). The wizard does not block during import — show a toast when import completes.
- **Step 4 — Scanning:** A full-screen progress view with a large animated scanning icon, "Scanned N of M" counter, and a live-updating mini grid of tracks as they appear. When scanning reaches 100%, show a "Go to Library →" button. The wizard is now complete — `onboarding_step = 4` is stored and the wizard never appears again.

---

### 27.2 Progressive Disclosure

**What it does:**
- Advanced features are discoverable but not pushed on new users. Contextual tooltips appear once and are dismissible.

**Implementation Notes:**

- **Tooltip system:** Define a `feature_tooltips` table: `{id TEXT PRIMARY KEY, shown_at INTEGER}`. Each tooltip has a unique ID. Before showing a tooltip, check if it's already been shown (`shown_at IS NOT NULL`). On dismiss or auto-close (after 6 seconds), write `shown_at = now()` to the table.
- **Tooltip triggers (examples):**
  - First time the queue empties and Smart Continuation fires: "Tip: Smart Queue added 10 similar tracks. Turn this off in Settings → Playback."
  - First time the user opens search: "Tip: Use field:value syntax for advanced search — try bpm:>120."
  - First time the user plays a track: "Tip: Press [Space] to pause, [N] for next track, [?] for all shortcuts."
  - First time the library reaches 100 tracks: "Tip: Smart Playlists can automatically organize your library by BPM, rating, and more."
- **Visual design:** Tooltips are small, non-blocking callout bubbles (speech-bubble style) pointing to the relevant UI element. A small ✕ button dismisses them. They never block interaction — the user can click through them.

---

### 27.3 Empty State Design

**What it does:**
- Every empty state has an illustration, a one-sentence explanation, and a primary CTA button.

**Implementation Notes:**

- **Empty states to implement (minimum):**
  - Library empty: SVG illustration of a music note and folder. Text: "Your library is empty — add a folder to get started." Button: [Add Folder].
  - No search results: SVG of a magnifying glass. Text: "No tracks match '{query}' — try a different search or check spelling." Button: [Clear Search].
  - Playlist empty: SVG of a playlist icon. Text: "This playlist has no tracks yet." Button: [Browse Library].
  - No podcasts: SVG of headphones. Text: "You haven't subscribed to any podcasts." Button: [Find Podcasts].
  - No downloads: SVG of a download icon. Text: "No downloaded files yet." Button: [Browse Library to Download].
  - History empty (new user): SVG of a clock. Text: "Your listening history will appear here as you play tracks." No button needed.
- **SVG illustrations:** Use simple, single-color SVG icons that adapt to the current theme via CSS `currentColor`. No bitmap images — they don't adapt to dark/light modes.

---

### 27.4 Keyboard Shortcut Cheat Sheet

**What it does:**
- `?` key opens a full keyboard shortcut overlay organized by category.

**Implementation Notes:**

- **Overlay:** A modal (dark semi-transparent backdrop) containing a two-column grid of shortcut tables. Categories: Playback, Queue & Navigation, Library, Video, Advanced. Each row: `[Key]   Action description`. Keys are rendered as `<kbd>` elements with a monospace bordered style.
- **Dynamic rendering:** The cheat sheet reads from the user's current keyboard shortcut mapping (§20.5 custom shortcuts) so it always shows the actual current bindings, not hardcoded defaults.
- **Dismiss:** `Escape` or `?` closes it. Clicking the backdrop closes it. A visible ✕ button in the top-right corner.

---

## Appendix: What ZOVYRA Does That No Single Competitor Does

| Capability | VLC | Spotify | Apple Music | YouTube | **ZOVYRA** |
|---|:---:|:---:|:---:|:---:|:---:|
| Universal local format support | ✅ | ❌ | ❌ | ❌ | ✅ |
| Gapless + crossfade | ✅ | ✅ | ✅ | ❌ | ✅ |
| Per-track BPM/key/energy analysis | ❌ | Partial | ❌ | ❌ | ✅ |
| Harmonic mixing (Camelot wheel) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Waveform seek bar | ❌ | ❌ | ❌ | ❌ | ✅ |
| A/B Loop | ✅ | ❌ | ❌ | ❌ | ✅ |
| Spatial audio (HRTF + head tracking) | ❌ | ❌ | ✅ | ❌ | ✅ |
| Synced + translatable lyrics | ❌ | ✅ | ✅ | ✅ | ✅ |
| Smart playlists (rule-based) | ❌ | ❌ | ✅ | ❌ | ✅ |
| Podcast + music in one app | ❌ | ✅ | Partial | ❌ | ✅ |
| Video + audio in one app | ✅ | ❌ | ❌ | ✅ | ✅ |
| Advanced EQ (5-band parametric) | ✅ | ❌ | ❌ | ❌ | ✅ |
| AI DJ voice transitions | ❌ | Partial | ❌ | ❌ | ✅ |
| No cloud account required | ✅ | ❌ | ❌ | ❌ | ✅ |
| Offline-first everywhere | ✅ | Partial | Partial | ❌ | ✅ |
| Cross-device LAN sync (no cloud) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Duplicate detection (waveform) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Year Recap + shareable card | ❌ | ✅ | ✅ | ❌ | ✅ |
| Natural language AI playlist builder | ❌ | ✅ | ❌ | ❌ | ✅ |
| Remote control via QR code | ❌ | ✅ (Spotify Connect) | Partial | ❌ | ✅ |
| AcoustID track identification | ❌ | ❌ | ❌ | ❌ | ✅ |
| Local collaborative filtering | ❌ | ✅ (cloud) | ✅ (cloud) | ✅ (cloud) | ✅ (local) |
| Subtitle support (SRT/ASS/VTT) | ✅ | ❌ | ❌ | ✅ | ✅ |
| Hardware decode badge | ❌ | ❌ | ❌ | ❌ | ✅ |
| Low Power Mode auto-detection | ❌ | ❌ | ❌ | ❌ | ✅ |

---

*Last updated: May 2026. All features are designed to be feasible within the ZOVYRA stack: React + TypeScript (frontend), Node.js + TypeScript (server), Rust + NAPI-RS + FFmpeg (native engine), SQLite (database), Web Audio API (audio graph), Tauri (desktop + mobile), Capacitor (mobile alternative).*