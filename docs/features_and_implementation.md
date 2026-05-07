# Sonic Media Player - Technical Research & Implementation Plan

## 1. Native Functionalities of Famous Players

| Player | Key Native Features | Addictive Elements |
| :--- | :--- | :--- |
| **VLC** | Hardware acceleration, universal codec support, skinning, network streaming. | Reliability; "it just works" for any file. |
| **Spotify** | Gapless playback, seamless cross-device handoff, social listening. | Personalized discovery, smooth transitions. |
| **Plex** | Media indexing, metadata scraping, transcode on-the-fly. | Visual library organization, remote access. |
| **MPC-HC** | Low resource usage, custom shaders, frame-step. | Pure performance, enthusiast control. |

## 2. Innovative "Addictive" Features (Targeted for Sonic)

1.  **AI Mood Engine (Implemented):** Real-time audio analysis that allows users to shift the "vibe" of their queue using a single slider (Chill <-> Hype).
2.  **Waveform Heatmaps:** Visual navigation bar showing energy peaks in a song/video, allowing users to jump to the most "intense" parts.
3.  **BPM-Synced Crossfading:** Uses Rust-based audio analysis to match beats during transitions, creating a non-stop "flow" state.
4.  **Spectral Backgrounds:** UI that reacts at 60fps to audio frequencies with low-latency using Rust-calculated FFT (Fast Fourier Transform).

## 3. Implementation Strategy

### Backend (Node.js + Rust)
*   **Node.js (TypeScript):** Handles REST/GraphQL APIs, user authentication, and high-level playlist management.
*   **Rust (via NAPI-RS):**
    *   **Audio Analysis:** Use `ffmpeg-next` for decoding and `realfft` for calculating BPM and spectral features.
    *   **Low Latency:** Offload CPU-heavy tasks like waveform generation to Rust threads to keep the Node.js event loop free.

### Frontend (React + Vite)
*   **Tailwind CSS:** For the sleek, "glassmorphism" inspired dark UI.
*   **Responsive Design:** Dedicated mobile fullscreen player with gesture-based controls.
*   **State Management:** TanStack Query for data fetching and React Context for playback state.
