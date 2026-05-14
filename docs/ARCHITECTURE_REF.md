# Zovyra Media Platform Architecture Reference

## Overview

Zovyra is designed as a professional-grade, cross-platform media infrastructure that prioritizes maximum capability, standalone distribution, and industrial-strength media processing.

## Core Architectural Decisions

### 1. Modular Rust Native Core (`native/`)
The native layer is refactored into a domain-driven modular architecture:
- **`decoding.rs`**: Centralizes FFmpeg input handling and hardware codec probing.
- **`dsp.rs`**: Handles audio analysis (BPM, key, loudness) and ReplayGain.
- **`metadata.rs`**: Extracts tags and stream information using FFmpeg and image-processing crates.
- **`transcoding.rs`**: Manages thumbnail generation and video transformation.
- **`indexing.rs`**: High-performance filesystem scanning using `rayon`.
- **`visualization.rs`**: Waveform and fingerprint generation.
- **`subtitle.rs`**: Subtitle stream extraction and parsing.

### 2. Standalone Media Engine
To eliminate manual dependency installation (Task 2 & 4), Zovyra adopts a hybrid linking strategy:
- **Static Linking**: The Rust core prefers static linking against FFmpeg and Chromaprint.
- **Bundling**: Build scripts (`build.rs`) and CI pipelines are configured to support bundled static libraries in `native/vendor/ffmpeg/<os>-<arch>/`.
- **Reproducible Builds**: CI/CD workflows (GitHub Actions) now use a cross-platform matrix to generate deterministic `.node` binaries for macOS, Windows, and Linux.

### 3. Orchestration Layer (Node.js)
The server acts as the service orchestration layer, providing:
- **Resource Management**: Centralized SQLite (WAL mode) for metadata.
- **Task Scheduling**: Library scanning and background analysis.
- **API/WebSocket**: Real-time sync and remote control.

---

## Recommendations & Roadmap

### Tauri vs. Electron
- **Recommendation: Tauri.**
- **Reasoning**: Tauri provides a significantly smaller footprint, better performance by utilizing system webviews, and native Rust integration (matching our core). Since Zovyra already has a heavy Rust core, Tauri is the natural fit for the desktop wrapper.

### Mobile Architecture
- **Strategy**: Leverage **Tauri Mobile** (Alpha/Beta).
- **Core Sharing**: The Rust `native/` core should be compiled as a static library (`.a` or `.lib`) for iOS and Android. The Node.js orchestration logic may need a lightweight "Bridge" or be partially ported to Rust for mobile-only deployments, or run as a background service where permitted.

### GPU Acceleration Roadmap
- **Phase 1**: Implement VAAPI (Linux), VideoToolbox (macOS), and DXVA2 (Windows) probing in `decoding.rs`.
- **Phase 2**: Map FFmpeg's hardware-accelerated decoders (e.g., `h264_cuvid`, `hevc_videotoolbox`) into the `PlaybackEngine`.
- **Phase 3**: Use Vulkan/WGPU for real-time visualization 준비 (preparing waveforms/spectrograms) on the GPU.

### Plugin Architecture
- **Proposal**: Utilize **WebAssembly (WASM)** for sandboxed plugins.
- **Rust/Host**: Provide a host environment in the Rust core that can load `.wasm` modules for custom DSP effects or metadata parsers.
- **Frontend**: Allow UI extensions via React components loaded from external bundles.

---

## Conclusion
Zovyra is architected to surpass existing players by maintaining full FFmpeg power while delivering it in a modern, zero-dependency, and highly modular package.
