# Audio & Video Processing Optimization Strategy for ZOVYRA - Sprint Structure

## Executive Summary

ZOVYRA is positioned to become the next-generation media platform surpassing VLC (native) and Spotify (streaming). However, current audio/video processing architecture has critical gaps that must be addressed.

### Current State Analysis
- ✅ **Strengths:** Modern tech stack (Rust + FFmpeg, Web Audio API, multi-platform support via Tauri/Capacitor)
- ❌ **Critical Gaps:** 
  1. Server-side transcoding bottleneck (no stream-based chunking strategy)
  2. No adaptive bitrate streaming (ABR) for streaming platform
  3. Missing hardware acceleration on all platforms
  4. No audio codec prioritization for low-end devices
  5. Insufficient video codec optimization strategy
  6. No caching/CDN strategy for streaming
  7. Missing real-time performance monitoring

---

## Sprint 1: Foundation - Adaptive Bitrate Streaming & HLS/DASH

### Overview
Replace single-bitrate transcoding with segmented, adaptive streaming. This is critical for low-end device support and serves as the foundation for a Spotify-like streaming experience.

### Sprint Goals
- Implement HLS manifest generation
- Enable dynamic bitrate streaming
- Support on-demand segmentation
- Establish Redis caching for segments

### Tasks

#### 1.1 Backend HLS Service Implementation
**What:** Create server-side HLS manifest generation and segment delivery

**Why:** 
- ✅ Solves the "streaming platform" requirement
- ✅ Enables low-end device support (small buffers)
- ✅ Matches Spotify's architecture
- ✅ Automatic bandwidth adaptation

**Implementation:**

```typescript
// server/src/services/HLSTranscodeService.ts
const generateHLSManifest = async (trackId: string, targetBitrate?: number) => {
  // 1. Detect source codec & bitrate
  const metadata = await probeFile(track.file_path);
  
  // 2. If ALREADY H.264/AAC at appropriate bitrate, use native stream
  if (metadata.codec === 'aac' && metadata.bitrate <= 320) {
    return generateHLSFromNative(track, metadata);
  }
  
  // 3. Else: spawn FFmpeg transcode pipeline with segmentation
  const bitrates = [128, 192, 256, 320]; // quality ladder
  const seg = new spawn('ffmpeg', [
    '-i', track.file_path,
    '-c:a', 'aac',
    '-b:a', targetBitrate || '192k',
    '-hls_time', '6',           // 6-second segments
    '-hls_list_size', '10',     // buffer 10 segments
    '-f', 'hls',
    '-',                        // stdout
  ]);
  
  // 4. Write manifest + segments to Redis cache
  return { manifest: m3u8Content, uri: `/api/stream/${trackId}/playlist.m3u8` };
};
```

**Deliverables:**
- `server/src/services/HLSTranscodeService.ts`
- `server/src/routes/stream.ts` (rewrite)

#### 1.2 Frontend HLS Playback Integration
**What:** Implement client-side HLS playback with adaptive bitrate

**Implementation:**

```typescript
// frontend/src/hooks/useHLSPlayback.ts
import Hls from 'hls.js';

export function useHLSPlayback(videoRef: HTMLVideoElement, manifestUrl: string) {
  useEffect(() => {
    if (Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        maxMaxBufferLength: 30,     // 30s buffer (prevents OOM)
        maxBufferLength: 10,
        abrEwmaFastLive: 3,
      });
      hls.loadSource(manifestUrl);
      hls.attachMedia(videoRef);
    }
  }, [manifestUrl]);
}
```

**Frontend Changes:**
```typescript
// frontend/src/lib/PlaybackEngine.ts - Modification
async loadVideo(file: MediaFile, videoElement: HTMLVideoElement) {
  if (file.type === 'audio') {
    // Use HLS for ALL formats
    const manifestUrl = `/api/stream/${file.id}/playlist.m3u8`;
    videoElement.src = manifestUrl;
  }
}
```

**Deliverables:**
- `frontend/src/hooks/useHLSPlayback.ts`
- Update `frontend/src/lib/PlaybackEngine.ts`
- Install `npm install hls.js`

#### 1.3 Segment Caching Strategy
**What:** Cache generated segments in Redis to avoid repeated transcoding

**Implementation:**
```typescript
// server/src/middleware/CacheMiddleware.ts
app.get('/api/stream/:trackId/seg-:num.ts', async (req, res) => {
  const cacheKey = `seg:${req.params.trackId}:${req.params.num}`;
  
  const cached = await redis.get(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT');
    return res.send(cached);
  }
  
  const segment = await transcodeSegment(trackId, segmentNum);
  await redis.setex(cacheKey, 86400, segment);
  res.set('X-Cache', 'MISS');
  res.send(segment);
});
```

**Deliverables:**
- Segment caching middleware
- Redis cache configuration

### Success Criteria
- 🟢 128MB FLAC streams smoothly on 2GB RAM device
- 🟢 TTFB <500ms even on 3G
- 🟢 Adaptive bitrate responds to network changes

---

## Sprint 2: Hardware Acceleration - All Platforms

### Overview
Enable hardware video decoding on desktop, web, and mobile platforms to reduce CPU usage and improve performance.

### Sprint Goals
- Implement DXVA2/D3D11VA on Windows
- Add VideoToolbox support on macOS
- Enable VAAPI on Linux
- Leverage WebCodecs API on web
- Establish native bridges for mobile

### Tasks

#### 2.1 Desktop Hardware Acceleration (Tauri/FFmpeg)

**What:** Initialize and utilize platform-specific hardware decoders

**Windows/macOS/Linux Implementation:**

```rust
// native/src/decoding.rs - NEW FILE
use ffmpeg::ffi::*;

#[napi]
pub fn initialize_hardware_decode() -> Result<HardwareCodecSupport, napi::Error> {
    ffmpeg::init()?;
    
    let mut support = HardwareCodecSupport::default();
    
    // Windows: DXVA2 / D3D11VA
    #[cfg(target_os = "windows")]
    {
        unsafe {
            if av_hwdevice_ctx_create(/* DXVA2 */).is_ok() {
                support.h264 = true;
                support.hevc = true;
            } else if av_hwdevice_ctx_create(/* D3D11VA */).is_ok() {
                support.h264 = true;
                support.hevc = true;
                support.av1 = true;
            }
        }
    }
    
    // macOS: VideoToolbox
    #[cfg(target_os = "macos")]
    {
        unsafe {
            if av_hwdevice_ctx_create(/* VIDEOTOOLBOX */).is_ok() {
                support.h264 = true;
                support.hevc = true;
                support.av1 = true;
            }
        }
    }
    
    // Linux: VAAPI
    #[cfg(target_os = "linux")]
    {
        unsafe {
            if av_hwdevice_ctx_create(/* VAAPI */).is_ok() {
                support.h264 = true;
                support.hevc = true;
                support.av1 = true;
            }
        }
    }
    
    Ok(support)
}
```

**Deliverables:**
- `native/src/decoding.rs` (new)
- Update `native/src/lib.rs` with HW acceleration initialization

#### 2.2 Web Hardware Acceleration

**What:** Leverage WebCodecs API for hardware-accelerated decoding

```typescript
// frontend/src/hooks/useHardwareDecoding.ts - NEW FILE
export function useHardwareDecoding() {
  const [hwSupport, setHwSupport] = useState<CodecSupport>({
    h264: false,
    hevc: false,
    av1: false,
    vp9: false,
  });
  
  useEffect(() => {
    (async () => {
      const codecs = ['avc1.4d2015', 'hev1.1.6.L93.B0', 'av01.0.05M.08', 'vp9'];
      for (const codec of codecs) {
        const config = { codec, width: 1920, height: 1080 };
        try {
          const res = await VideoDecoder.isConfigSupported(config);
          if (res.supported && res.config?.hardwareAcceleration === 'prefer-hardware') {
            // Hardware decode available
          }
        } catch (e) {
          // Fallback to software decode
        }
      }
    })();
  }, []);
  
  return hwSupport;
}
```

**Deliverables:**
- `frontend/src/hooks/useHardwareDecoding.ts`
- `frontend/src/components/HWAccelBadge.tsx` (UI indicator)

#### 2.3 Mobile Hardware Acceleration (Capacitor)

**What:** Create native bridges for iOS/Android hardware decoding

```typescript
// frontend/src/services/mobileMedia/MobileMediaService.ts - REWRITE
export class MobileMediaService {
  static async initHardwareAccel(): Promise<boolean> {
    try {
      const result = await Capacitor.Plugins.MediaPlugin.initHardwareAccel?.();
      return result?.available ?? false;
    } catch (e) {
      return false;
    }
  }
}
```

**Swift Plugin (iOS):**
```swift
// ios/App/App/Plugins/MediaPlugin.swift
import Capacitor
import AVFoundation

@objc(MediaPlugin)
public class MediaPlugin: CAPPlugin {
  @objc func initHardwareAccel(_ call: CAPPluginCall) {
    let available = AVHardwareVideoDecoder.isAvailable()
    call.resolve(["available": available])
  }
}
```

**Deliverables:**
- iOS Capacitor plugin
- Android Capacitor plugin
- Updated `MobileMediaService.ts`

### Success Criteria
- 🟢 Desktop: GPU decodes 4K video → ~5% CPU (vs. 50% software)
- 🟢 Mobile: Native hardware decode available
- 🟢 Web: Explicit HW acceleration detection working

---

## Sprint 3: Device-Aware Codec Optimization

### Overview
Implement intelligent codec selection based on device capabilities to ensure smooth playback across all hardware tiers.

### Sprint Goals
- Detect device capability tier (low/mid/high)
- Create codec ladders per tier
- Implement bitrate adaptation
- Optimize for low-end devices

### Tasks

#### 3.1 Device Profile Detection

**What:** Detect and classify device capabilities

```typescript
// frontend/src/lib/DeviceProfile.ts - NEW FILE
type DeviceProfile = 'low' | 'mid' | 'high';

export function detectDeviceProfile(): DeviceProfile {
  const ram = (navigator as any).deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 2;
  
  if (ram <= 2 && cores <= 2) return 'low';
  if (ram <= 4 && cores <= 4) return 'mid';
  return 'high';
}

// Codec ladder per profile
const CODEC_LADDER = {
  low: {
    audio: ['mp3', 'aac'],      // minimal encoding overhead
    video: ['h264'],             // broad HW support, lower CPU
  },
  mid: {
    audio: ['aac', 'vorbis', 'opus'],
    video: ['h264', 'vp9'],
  },
  high: {
    audio: ['aac', 'opus', 'flac'],
    video: ['h264', 'hevc', 'av1'],
  },
};

// Bitrate ladder per profile
const BITRATE_LADDER = {
  low: { audio: 128, video: 500, resolution: '360p' },
  mid: { audio: 192, video: 2500, resolution: '720p' },
  high: { audio: 320, video: 5000, resolution: '1080p' },
};
```

**Deliverables:**
- `frontend/src/lib/DeviceProfile.ts`

#### 3.2 Backend Bitrate Adaptation

**What:** Backend selects appropriate bitrate based on device profile

```typescript
// server/src/services/TranscodeService.ts - REWRITE
async transcodeToBitrate(file: string, deviceProfile: DeviceProfile) {
  const bitrates = {
    low: { audio: 128, video: 500, resolution: '360p' },
    mid: { audio: 192, video: 2500, resolution: '720p' },
    high: { audio: 320, video: 5000, resolution: '1080p' },
  };
  
  const { audio, video, resolution } = bitrates[deviceProfile];
  
  return spawn('ffmpeg', [
    '-i', file,
    '-c:a', 'aac', '-b:a', `${audio}k`,
    '-c:v', 'libx264', '-b:v', `${video}k`, '-s', resolution,
    // ... HLS segmentation
  ]);
}
```

**Deliverables:**
- Rewrite `server/src/services/TranscodeService.ts`
- Update `frontend/src/lib/PlaybackEngine.ts` to pass device profile

#### 3.3 Client-Side Codec Prioritization

**What:** Frontend requests appropriate codec based on device tier

**Implementation:**
- Pass `deviceProfile` to PlaybackEngine
- Adjust HLS manifest generation parameters
- Request lowest viable bitrate for device

**Deliverables:**
- Updated PlaybackEngine implementation
- Device profile parameter passing

### Success Criteria
- 🟢 Low-end: MP3 @ 128kbps streams smoothly
- 🟢 Mid-end: Opus @ 192kbps + 720p video
- 🟢 High-end: FLAC / 5Mbps video

---

## Sprint 4: Audio Analysis & Genre Classification

### Overview
Expand audio analysis to include genre detection and advanced audio features for better recommendations and playlist generation.

### Sprint Goals
- Add spectral analysis for genre detection
- Implement speech vs. music detection
- Add dynamic range analysis
- Enable vocal detection

### Tasks

#### 4.1 Advanced Audio Analysis Features

**What:** Expand DSP analysis pipeline with machine learning capabilities

```rust
// native/src/dsp.rs - ADDITIONS to analyze_audio()
#[napi]
pub fn analyze_audio(path: String) -> Result<AudioAnalysis, napi::Error> {
    // ... existing BPM, key, energy, loudness ...
    
    // NEW: Spectral flux for genre hints
    let spectrogram = compute_spectrogram(&samples, sample_rate);
    let genre_features = extract_genre_features(&spectrogram);
    
    // NEW: Speech detection
    let speech_confidence = detect_speech(&samples, sample_rate);
    
    // NEW: Dynamic range analysis
    let dynamic_range_db = analyze_dynamic_range(&samples);
    
    // NEW: Vocal detection
    let vocal_confidence = detect_vocals(&spectrogram);
    
    Ok(AudioAnalysis {
        bpm,
        key,
        energy,
        loudness_lufs,
        genre_probabilities: {
            "rock": 0.45,
            "pop": 0.35,
            "electronic": 0.15,
        },
        speech_confidence,
        dynamic_range_db,
        vocal_confidence,
    })
}
```

#### 4.2 Genre Classification Integration

**What:** Use TensorFlow.js ONNX model for multi-genre classification

**Implementation:**
- Load pre-trained ONNX model for genre classification (~10 genres)
- Extract features from spectrogram
- Cache genre classifications per track
- Use for playlist generation and recommendations

**Deliverables:**
- Updated `native/src/dsp.rs`
- Genre classification model files
- Database schema updates for genre metadata

### Success Criteria
- 🟢 Genre detection enables mood-based playlists
- 🟢 Speech vs. music detection improves content filtering
- 🟢 Dynamic range analysis data available for audio processing

---

## Sprint 5: Streaming Platform Infrastructure - Caching & CDN

### Overview
Implement enterprise-grade caching and CDN integration for sub-100ms segment delivery on the streaming platform.

### Sprint Goals
- Pre-encode popular tracks in multiple bitrates
- Implement edge CDN integration
- Establish caching strategy with TTL management
- Monitor cache hit rates

### Tasks

#### 5.1 CDN-Ready Segment Caching

**What:** Cache popular segments in Redis and prepare for CDN distribution

```typescript
// server/src/middleware/CacheMiddleware.ts - ENHANCEMENT
app.get('/api/stream/:trackId/seg-:num.ts', async (req, res) => {
  const cacheKey = `seg:${req.params.trackId}:${req.params.num}`;
  
  // Check Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(cached);
  }
  
  // Generate on-demand, then cache
  const segment = await transcodeSegment(trackId, segmentNum);
  await redis.setex(cacheKey, 86400, segment); // cache 24h
  
  res.set('X-Cache', 'MISS');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(segment);
});
```

#### 5.2 Pre-Encoding Popular Tracks

**What:** Background job to pre-encode top 100 tracks in multiple bitrates

**Implementation:**
- Track popularity metrics
- Trigger pre-encoding for top 100 tracks
- Cache segments in Redis
- Schedule during off-peak hours

**Deliverables:**
- Background job implementation
- Pre-encoding service
- Popularity tracking service

#### 5.3 CDN Integration (Cloudflare/BunnyCDN)

**What:** Configure edge CDN for segment delivery

**Implementation:**
- Set up Cloudflare/BunnyCDN origin
- Configure cache rules per content type
- Implement purge strategies
- Monitor cache performance metrics

**Deliverables:**
- CDN configuration
- Cache invalidation service
- Performance monitoring dashboard

### Success Criteria
- 🟢 Popular songs cache hit rate ~95%
- 🟢 <100ms segment delivery via CDN
- 🟢 Zero cache misses for top tracks

---

## Sprint 6: Real-Time Performance Monitoring & Auto-Adaptation

### Overview
Implement monitoring infrastructure to track performance and enable automatic adaptation to network conditions.

### Sprint Goals
- Measure network quality in real-time
- Auto-adapt bitrate based on network performance
- Monitor CPU and memory usage
- Log performance metrics for analysis

### Tasks

#### 6.1 Network Quality Detection

**What:** Monitor network performance and adapt streaming quality

```typescript
// frontend/src/hooks/useNetworkQuality.ts - NEW
export function useNetworkQuality() {
  const [quality, setQuality] = useState<'poor' | 'fair' | 'good' | 'excellent'>('good');
  
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        if (entry.name.includes('/api/stream/')) {
          const duration = entry.duration;
          if (duration > 5000) setQuality('poor');
          else if (duration > 2000) setQuality('fair');
          else if (duration > 500) setQuality('good');
          else setQuality('excellent');
        }
      }
    });
    observer.observe({ entryTypes: ['resource'] });
  }, []);
  
  return quality;
}
```

#### 6.2 HLS.js Bitrate Adaptation

**What:** Integrate network quality detection with HLS bitrate selection

```typescript
hls.on(Hls.Events.hlsFragmentLoading, (data) => {
  const networkQuality = useNetworkQuality();
  
  if (networkQuality === 'poor') {
    hls.nextLevel = 0; // force lowest bitrate
  } else if (networkQuality === 'fair') {
    hls.nextLevel = 1; // mid bitrate
  } else {
    hls.nextLevel = -1; // auto select
  }
});
```

#### 6.3 Performance Analytics

**What:** Collect and analyze performance metrics

**Implementation:**
- Track playback quality metrics
- Monitor buffer underruns
- Measure seeking latency
- Log bandwidth estimates
- Export metrics to analytics backend

**Deliverables:**
- Performance monitoring service
- Analytics dashboard
- Real-time alerting system

### Success Criteria
- 🟢 Auto-bitrate adapt to network changes within 30 seconds
- 🟢 Zero buffer underruns on consistent connections
- 🟢 Performance metrics available for all playback sessions

---

## Sprint 7: Desktop Performance Optimization - Zero-Copy Decoding

### Overview
Optimize desktop (Tauri) video processing by implementing zero-copy texture streaming and eliminating unnecessary memory copies.

### Sprint Goals
- Implement GPU texture streaming
- Avoid system RAM intermediate buffers
- Support 4K playback with minimal overhead
- Achieve VLC-level efficiency

### Tasks

#### 7.1 Zero-Copy Video Texture Streaming

**What:** Use GPU directly for decoding and rendering without system RAM copies

```rust
// native/src/streaming.rs - NEW
#[napi]
pub fn create_video_texture_stream(path: String) -> Result<(), napi::Error> {
    // Use CUDA/Metal/D3D to decode directly to GPU texture
    // Avoids system RAM altogether
    
    // Initialize GPU context based on platform
    #[cfg(target_os = "windows")]
    {
        // D3D11 texture streaming
        let device = create_d3d11_device()?;
        let decoder = create_gpu_decoder(&device)?;
    }
    
    #[cfg(target_os = "macos")]
    {
        // Metal texture streaming
        let device = create_metal_device()?;
        let decoder = create_gpu_decoder(&device)?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // VAAPI texture streaming
        let device = create_vaapi_device()?;
        let decoder = create_gpu_decoder(&device)?;
    }
    
    Ok(())
}
```

#### 7.2 Memory-Efficient Frame Handling

**What:** Implement ring buffer for decoded frames without excessive copying

**Implementation:**
- Pre-allocate GPU memory
- Use frame flipping instead of copies
- Implement double/triple buffering
- Minimize latency between decode and display

**Deliverables:**
- `native/src/streaming.rs`
- GPU memory management utilities
- Frame buffer implementation

#### 7.3 Platform-Specific Optimizations

**What:** Optimize for each desktop platform

**Windows:**
- D3D11 video decoding
- WDDM (Windows Display Driver Model) optimization

**macOS:**
- Metal GPU rendering
- VideoToolbox integration

**Linux:**
- VAAPI optimization
- X11/Wayland compatibility

**Deliverables:**
- Platform-specific GPU modules
- Cross-platform abstraction layer

### Success Criteria
- 🟢 4K playback at <5% CPU (hardware decode)
- 🟢 Zero perceptible lag on seek
- 🟢 Matches VLC performance metrics

---

## Sprint 8: Smart Buffer Management

### Overview
Implement intelligent buffer management that adapts to device capabilities and network conditions.

### Sprint Goals
- Calculate optimal buffer sizes per device tier
- Prevent OOM on low-memory devices
- Maintain smooth playback across all scenarios
- Implement predictive prefetching

### Tasks

#### 8.1 Adaptive Buffer Size Calculation

**What:** Determine buffer strategy based on device profile

```typescript
// frontend/src/lib/BufferManager.ts - NEW
class BufferManager {
  private targetBufferSize: number;
  private segmentDuration: number;
  
  constructor(deviceProfile: DeviceProfile, bitrate: number) {
    switch (deviceProfile) {
      case 'low':
        // 1MB max buffer = ~60 seconds at 128kbps
        this.targetBufferSize = 1024 * 1024;
        this.segmentDuration = 6;  // 6s segments
        break;
      case 'mid':
        // 5MB max buffer = ~200 seconds at 192kbps
        this.targetBufferSize = 5 * 1024 * 1024;
        this.segmentDuration = 10;
        break;
      case 'high':
        // 30MB max buffer
        this.targetBufferSize = 30 * 1024 * 1024;
        this.segmentDuration = 15;
        break;
    }
  }
  
  getRecommendedSegmentDuration(): number {
    return this.segmentDuration;
  }
  
  getMaxBufferSize(): number {
    return this.targetBufferSize;
  }
  
  getOptimalBufferTarget(): number {
    // 50% of max buffer for smooth playback
    return this.targetBufferSize / 2;
  }
}
```

#### 8.2 Buffer State Monitoring

**What:** Monitor and log buffer fill levels in real-time

**Implementation:**
- Track buffer fill percentage
- Monitor segment fetch times
- Detect buffer underruns
- Alert on anomalies

**Deliverables:**
- Buffer monitoring service
- Real-time metrics collection

#### 8.3 Predictive Prefetching

**What:** Prefetch segments likely to be needed based on playback pattern

**Implementation:**
- Analyze current bitrate and network speed
- Calculate estimated buffer drain rate
- Fetch next segments preemptively
- Reduce stall probability

**Deliverables:**
- Prefetch prediction algorithm
- Segment fetch scheduler

### Success Criteria
- 🟢 Low-end: never buffers more than 1MB
- 🟢 No OOM on 2GB devices
- 🟢 Playback stays smooth with <1% stalls

---

## Sprint 9: Streaming Ecosystem - License-Free Music Integration

### Overview
Integrate license-free music sources to establish an initial catalog for the streaming platform.

### Sprint Goals
- Connect to independent music APIs
- Support artist direct uploads
- Implement license tracking
- Create content discovery features

### Tasks

#### 9.1 License-Free Music Library Integration

**What:** Integrate with open music sources

```typescript
// server/src/services/StreamingLibraryService.ts - NEW
async function searchLibreMusic(query: string) {
  // Query ccMixter API
  const results = await fetch(`https://ccmixter.org/api/...?q=${query}`);
  return results.map(r => ({
    artist: r.artistName,
    title: r.trackTitle,
    license: r.license,
    url: r.downloadUrl,
    metadata: {
      genre: r.genre,
      bpm: r.bpm,
      duration: r.duration,
    }
  }));
}

// Query Internet Archive
async function searchInternetArchive(query: string) {
  const results = await fetch(`https://archive.org/advancedsearch.php?q=${query}`);
  return results.map(r => ({ /* format to standard */ }));
}

// Query FreeMusic Archive
async function searchFreeMusic(query: string) {
  const results = await fetch(`https://freemusicarchive.org/api/...?q=${query}`);
  return results.map(r => ({ /* format to standard */ }));
}
```

#### 9.2 Artist Direct Upload System

**What:** Enable artists to upload and distribute music directly

**Implementation:**
- Artist registration and verification
- Upload interface with validation
- Automatic metadata extraction
- Distribution to streaming endpoints
- Royalty/analytics dashboard

**Deliverables:**
- Artist upload service
- Content verification pipeline
- Artist analytics dashboard

#### 9.3 License & Attribution Management

**What:** Ensure proper license attribution and compliance

**Implementation:**
- Store license metadata for all tracks
- Display license information in UI
- Generate license compliance reports
- Enable proper attribution in playlists

**Deliverables:**
- License metadata schema
- License compliance system
- Attribution UI components

### Success Criteria
- 🟢 "Streaming platform" has initial music catalog (10K+ tracks)
- 🟢 Artists can distribute directly
- 🟢 All content properly licensed and attributed

---

## Implementation Priorities & Dependencies

### Phase 1 (Critical - Foundation)
1. **Sprint 1:** HLS/DASH Implementation (blocks Sprints 3, 5)
2. **Sprint 2:** Hardware Acceleration (blocks Sprint 7)

### Phase 2 (High - Enablement)
3. **Sprint 3:** Device Profile & Codec Optimization (depends on Sprint 1)
4. **Sprint 4:** Audio Analysis & Genre Classification (independent)

### Phase 3 (High - Platform Features)
5. **Sprint 5:** Caching & CDN (depends on Sprint 1)
6. **Sprint 6:** Performance Monitoring (depends on Sprint 1)

### Phase 4 (Medium - Desktop Enhancement)
7. **Sprint 7:** Zero-Copy Video Decoding (depends on Sprint 2)
8. **Sprint 8:** Smart Buffer Management (depends on Sprint 1, 3)

### Phase 5 (Low - Ecosystem)
9. **Sprint 9:** Streaming Library Integration (independent)

---

## Success Metrics

### After Sprint 1 & 2:
- ✅ 128MB FLAC streams smoothly on 2GB RAM device
- ✅ 4K video plays at <10% CPU on desktop
- ✅ TTFB <500ms even on 3G

### After Sprint 3:
- ✅ Low-end device gets <128kbps audio automatically
- ✅ Mid-range device gets 192kbps + 720p video
- ✅ High-end device gets lossless audio + 4K

### After Sprint 4:
- ✅ Genre detection enables mood-based playlists
- ✅ Speech detection improves podcast handling

### After Sprints 5 & 6:
- ✅ Popular tracks pre-cached with <100ms delivery
- ✅ Auto-bitrate adapt to network changes
- ✅ Performance dashboards show real-time metrics

### After Sprint 7:
- ✅ 4K playback at <5% CPU (hardware decode)
- ✅ Zero perceptible lag on seek
- ✅ Matches VLC performance

### After Sprint 8:
- ✅ Smooth playback on all device tiers
- ✅ No OOM on low-memory devices

### After Sprint 9:
- ✅ Initial streaming catalog available
- ✅ Artists can upload directly
- ✅ Competitive differentiation established

---

## Competitive Positioning

### vs. VLC (Native Desktop)
| Feature | VLC | ZOVYRA (Post-Optimization) |
|---------|-----|----------------------------|
| 4K HW Decode | ✅ | ✅ |
| Format Support | ~90% | 95%+ (via HLS fallback) |
| Memory Efficiency | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Metadata Analysis | ❌ | ✅ |
| AI Recommendations | ❌ | ✅ |
| **Advantage** | Playback | **Smart Discovery** |

### vs. Spotify (Streaming Platform)
| Feature | Spotify | ZOVYRA (Post-Optimization) |
|---------|---------|---------------------------|
| HLS Streaming | ✅ | ✅ |
| Adaptive Bitrate | ✅ | ✅ |
| Offline Download | ✅ | ✅ |
| Local Library | ❌ | ✅ |
| Artist Direct Upload | ❌ | ✅ |
| **Advantage** | Scale | **Freedom + Local** |

---

## Risk Mitigation & Trade-Offs

### Licensing Considerations
- **FFmpeg:** LGPL compliance required if distributing prebuilt binaries
- **Solution:** Ship with libavcodec notices; consider Fraunhofer MP3 licensing for distributed platform

### Browser Compatibility
- **Issue:** HLS not natively supported on Firefox, Safari older versions
- **Solution:** Use hls.js polyfill + DASH.js fallback

### Transcoding Server Load
- **Challenge:** 1000 concurrent users = 50 concurrent FFmpeg processes = ~16 CPU cores required
- **Solution:** Use async FFmpeg pool + Redis segment cache + CDN distribution

### Mobile Compliance
- **Issue:** App Store policies may restrict codec licensing
- **Solution:** Work with legal team on licensing agreements early

---

## Conclusion

To surpass VLC and Spotify, ZOVYRA must address audio/video processing bottlenecks systematically across 9 focused sprints. Each sprint builds on previous work, with clear dependencies and measurable outcomes.

The structured sprint approach enables:
- ✅ Smooth playback on **2GB RAM devices** (beats Spotify's bloat)
- ✅ **4K @ 5% CPU** on desktop (matches VLC)
- ✅ **Sub-100ms TTFB** for streaming (beats Spotify's 500ms)
- ✅ **Local library + streaming** (beats both competitors)

This roadmap is **realistic and achievable with disciplined execution** and results in a **true next-generation media OS.**
