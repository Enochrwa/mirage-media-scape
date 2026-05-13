# ZOVYRA Architectural Correctness Audit

## PHASE A — RUST / NODE BOUNDARY VALIDATION
- **Audio Processing Logic**: BPM, key, energy, loudness, fingerprinting, and metadata extraction are implemented in Rust (`native/src/lib.rs`).
- **Node.js Violations**: `server/src/services/scan-worker.ts` handles cover art writing to disk, but extraction is in Rust.
- **NAPI Layer**: A single unified NAPI-RS interface is used via `zovyra-native.node`. No fallback logic in JS/TS was found for core audio tasks.

## PHASE B — PLAYBACK ENGINE DEPENDENCY RISK
- **Technology Stack**: `PlaybackEngine.ts` currently uses `AudioBufferSourceNode` (Web Audio API) with `fetch` + `decodeAudioData`.
- **Compliance**: It does NOT use `HTMLMediaElement` as required by Phase 6. The audio graph is partially canonical but needs repositioning and removal of non-canonical nodes (e.g., `Convolver`).
- **Breakable Dependencies**:
  - `usePlayerStore.ts`: Depends on `playbackEngine.play(audioBuffer, ...)` and `preBufferNextTrack`.
  - `StatsService`: Depends on events emitted from the display layer via `fetch` calls in `usePlayerStore.ts` (Layer violation).
  - `SyncManager`: Depends on `POSITION_CHECKPOINT` emitted from store listeners.

## PHASE C — RECOMMENDATION ENGINE VALIDITY
- **Normalization**: Vector normalization logic is currently in `RecommendationService.ts` (per-query). Needs consolidation if used elsewhere.
- **Missing Fields**: Handled via population median (calculated per-query) in `RecommendationService.ts`.
- **Co-play Score**: Normalization is per-query based on max score for the target track's pairs.
- **Determinism**: Deterministic for identical database states.

## PHASE D — SMART PLAYLIST SQL SAFETY
- **SQL Safety**: `SmartPlaylistService.ts` uses parameterized queries for values, but operator clauses and field names are built by joining strings.
- **Injection Risks**: Field names and operators are hardcoded in the builder, providing reasonable safety, but the `Definition` interface allows arbitrary field strings.

## PHASE E — LIBRARY SCANNER & WORKER CONCURRENCY
- **Model**: Sequential processing of files within a single worker thread.
- **Blocking**: Rust calls are synchronous within the worker but don't block the main Node.js thread.
- **Scalability**: Can handle 10k+ files but lacks parallel processing of metadata extraction (though scanning itself is parallel in Rust).

## PHASE F — EVENT SYSTEM CONSISTENCY
- **Event Sources**:
  - `play_events` table (Stats).
  - `sync_log` table (Sync).
  - `DOWNLOAD_PROGRESS` (Socket.io).
- **Duplication**: Play tracking is initiated in `usePlayerStore.ts` (React layer), violating the law that display layers should only emit user events.
- **Risks**: Double counting if multiple components or stores call the stats API. Race conditions in `POSITION_CHECKPOINT` for sync.

## PHASE G — ARCHITECTURE CHANGE IMPACT ANALYSIS
- **Affected Services**: `PlaybackEventService` must be the sole owner of play events.
- **Affected Routes**: `/api/stats/event` needs to handle `HTMLMediaElement` lifecycle transitions.
- **Invalidated Features**: Current gapless crossfading in `PlaybackEngine` (using `AudioBufferSourceNode`) will need a complete rewrite for `HTMLMediaElement`.

---

# AUDIT FINDINGS

### 🔴 Critical Violations
1. **Layer Violation (React Logic)**: `usePlayerStore.ts` handles audio decoding (`decodeAudioData`), AI DJ logic, and stats reporting. This must move to `PlaybackEngine.ts` or Node.js services.
2. **Layer Violation (Node/Rust)**: `scan-worker.ts` has some logic for file type detection that should be solely in Rust metadata.
3. **Architecture Law 3 (Display Layer)**: React store is computing queue logic and extensions which should be in `QueueManager.ts`.

### 🟠 High Risk Inconsistencies
1. **Playback Source**: `PlaybackEngine` uses `AudioBuffer` instead of `HTMLMediaElement`. This makes handling long files (videos, podcasts) memory-intensive and violates Phase 6.
2. **Audio Graph**: Non-canonical nodes (`Convolver`, `BassEnhancer` outside spec) exist in the chain.

### 🟡 Medium Design Concerns
1. **Smart Playlist SQL**: Builder joins strings for clauses. While currently safe with controlled inputs, it's a weak point.
2. **Scanner Concurrency**: Sequential metadata extraction in the worker.

---

# RECOMMENDATION

**"Refactor PlaybackEngine first"**

The dependency of stats, sync, and UI on the current `AudioBuffer`-based `PlaybackEngine` is the largest risk. Converting to `HTMLMediaElement` and enforcing the canonical graph will fix multiple layer violations and align the system with Phase 6 before more API routes are built on top of incorrect timing assumptions.
