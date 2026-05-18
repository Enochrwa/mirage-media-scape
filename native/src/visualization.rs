use napi_derive::napi;
use ffmpeg_next as ffmpeg;
use std::path::Path;
use ffmpeg::util::frame::audio::Audio;

#[napi(object)]
pub struct FingerprintResult {
    pub fingerprint: String,
    pub duration: f64,
}

// ── Waveform ─────────────────────────────────────────────────────────────────

#[napi]
pub fn generate_waveform(path: String) -> Result<Vec<f32>, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let mut ictx = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    let stream = ictx
        .streams()
        .best(ffmpeg::media::Type::Audio)
        .ok_or_else(|| napi::Error::from_reason("Could not find best audio stream"))?;

    let stream_index = stream.index();
    let stream_duration_ts = stream.duration();
    let time_base = stream.time_base();

    let mut decoder = ffmpeg::codec::context::Context::from_parameters(stream.parameters())
        .map_err(|e| napi::Error::from_reason(format!("Failed to get codec context: {}", e)))?
        .decoder()
        .audio()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get audio decoder: {}", e)))?;

    let mut resampler = ffmpeg::software::resampling::context::Context::get(
        decoder.format(),
        decoder.channel_layout(),
        decoder.rate(),
        ffmpeg::util::format::sample::Sample::F32(ffmpeg::util::format::sample::Type::Packed),
        ffmpeg::util::channel_layout::ChannelLayout::MONO,
        decoder.rate(),
    )
    .map_err(|e| napi::Error::from_reason(format!("Resampler error: {}", e)))?;

    let num_buckets: usize = 1000;
    let duration_secs = {
        let container_dur = ictx.duration() as f64 / ffmpeg::ffi::AV_TIME_BASE as f64;
        if container_dur > 0.0 {
            container_dur
        } else if stream_duration_ts > 0 {
            stream_duration_ts as f64 * f64::from(time_base)
        } else {
            0.0
        }
    };

    if duration_secs <= 0.0 {
        return Ok(vec![0.0f32; num_buckets]);
    }

    let mut bucket_sum_sq = vec![0.0f64; num_buckets];
    let mut bucket_counts = vec![0usize; num_buckets];

    for (stream, packet) in ictx.packets() {
        if stream.index() != stream_index { continue; }
        if decoder.send_packet(&packet).is_err() { continue; }
        let mut decoded = Audio::empty();
        while decoder.receive_frame(&mut decoded).is_ok() {
            let pts_secs = decoded.pts().unwrap_or(0) as f64 * f64::from(time_base);
            let bucket_idx = ((pts_secs / duration_secs) * num_buckets as f64) as usize;
            let bucket_idx = bucket_idx.min(num_buckets - 1);

            let mut resampled = Audio::empty();
            if resampler.run(&decoded, &mut resampled).is_ok() {
                let data = resampled.data(0);
                let samples: &[f32] = unsafe {
                    std::slice::from_raw_parts(data.as_ptr() as *const f32, data.len() / 4)
                };
                for &s in samples {
                    bucket_sum_sq[bucket_idx] += (s as f64) * (s as f64);
                    bucket_counts[bucket_idx] += 1;
                }
            }
        }
    }

    let mut buckets: Vec<f32> = bucket_sum_sq
        .iter()
        .zip(bucket_counts.iter())
        .map(|(&sq, &cnt)| {
            if cnt > 0 { (sq / cnt as f64).sqrt() as f32 } else { 0.0f32 }
        })
        .collect();

    let global_max = buckets.iter().cloned().fold(0.0f32, f32::max);
    if global_max > 0.0 {
        for peak in buckets.iter_mut() { *peak /= global_max; }
    }

    Ok(buckets)
}

// ── Waveform fingerprint (fast, for duplicate detection) ──────────────────────

#[napi]
pub fn generate_waveform_fingerprint(path: String) -> Result<String, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let mut ictx = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    let stream = ictx
        .streams()
        .best(ffmpeg::media::Type::Audio)
        .ok_or_else(|| napi::Error::from_reason("Could not find best audio stream"))?;

    let stream_index = stream.index();

    let mut decoder = ffmpeg::codec::context::Context::from_parameters(stream.parameters())
        .map_err(|e| napi::Error::from_reason(format!("Failed to get codec context: {}", e)))?
        .decoder()
        .audio()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get audio decoder: {}", e)))?;

    let mut resampler = ffmpeg::software::resampling::context::Context::get(
        decoder.format(),
        decoder.channel_layout(),
        decoder.rate(),
        ffmpeg::util::format::sample::Sample::F32(ffmpeg::util::format::sample::Type::Packed),
        ffmpeg::util::channel_layout::ChannelLayout::MONO,
        8000,
    )
    .map_err(|e| napi::Error::from_reason(format!("Resampler error: {}", e)))?;

    let mut samples: Vec<f32> = Vec::with_capacity(480_000);
    let max_samples = 480_000;

    'outer: for (stream, packet) in ictx.packets() {
        if stream.index() != stream_index { continue; }
        if decoder.send_packet(&packet).is_err() { continue; }
        let mut decoded = Audio::empty();
        while decoder.receive_frame(&mut decoded).is_ok() {
            let mut resampled = Audio::empty();
            if resampler.run(&decoded, &mut resampled).is_ok() {
                let data = resampled.data(0);
                let frame_samples: &[f32] = unsafe {
                    std::slice::from_raw_parts(data.as_ptr() as *const f32, data.len() / 4)
                };
                samples.extend_from_slice(frame_samples);
            }
            if samples.len() >= max_samples { break 'outer; }
        }
    }

    if samples.is_empty() {
        return Err(napi::Error::from_reason("No audio samples decoded"));
    }

    let window_size = (samples.len() / 32).max(1);
    let mut fingerprint = String::with_capacity(64);
    for i in 0..32 {
        let start = i * window_size;
        let end = if i == 31 { samples.len() } else { (i + 1) * window_size };
        let window = &samples[start..end];
        let sum_sq: f32 = window.iter().map(|&s| s * s).sum();
        let rms = (sum_sq / window.len() as f32).sqrt();
        let normalized = (rms * 255.0).min(255.0) as u8;
        fingerprint.push_str(&format!("{:02x}", normalized));
    }

    Ok(fingerprint)
}

// ── AcoustID-style audio fingerprint (pure Rust, no system libs) ──────────────
//
// Algorithm: sub-band energy fingerprint
//
// This is a content-based audio fingerprint suitable for:
//   • Duplicate detection within Zovyra's library
//   • Track identification across re-encodings / bitrate changes
//
// It is NOT the same binary format as AcoustID/Chromaprint (which requires
// the libchromaprint C library).  For MusicBrainz lookups use the server's
// fpcalc subprocess path instead (no Rust FFI needed there).
//
// Algorithm sketch:
//   1. Decode + resample to mono 11025 Hz f32
//   2. Slice into overlapping 4096-sample frames (hop 512)
//   3. For each frame, compute power in 8 logarithmically-spaced sub-bands
//   4. Compare adjacent frames: encode rising/falling energy per band as bits
//   5. Pack bits into 32-bit words → hex string
//
// This gives a 256-bit fingerprint per ~30 s segment, robust to:
//   MP3/AAC/OGG re-encoding, minor tempo changes, level normalization.
#[napi]
pub fn generate_fingerprint(path: String) -> Result<FingerprintResult, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let mut ictx = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    let stream = ictx
        .streams()
        .best(ffmpeg::media::Type::Audio)
        .ok_or_else(|| napi::Error::from_reason("Could not find best audio stream"))?;

    let stream_index = stream.index();
    let time_base = stream.time_base();

    let mut decoder = ffmpeg::codec::context::Context::from_parameters(stream.parameters())
        .map_err(|e| napi::Error::from_reason(format!("Failed to get codec context: {}", e)))?
        .decoder()
        .audio()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get audio decoder: {}", e)))?;

    // Resample to mono 11025 Hz — low rate is enough for fingerprinting
    let target_rate: u32 = 11025;
    let mut resampler = ffmpeg::software::resampling::context::Context::get(
        decoder.format(),
        decoder.channel_layout(),
        decoder.rate(),
        ffmpeg::util::format::sample::Sample::F32(ffmpeg::util::format::sample::Type::Packed),
        ffmpeg::util::channel_layout::ChannelLayout::MONO,
        target_rate,
    )
    .map_err(|e| napi::Error::from_reason(format!("Resampler error: {}", e)))?;

    // Collect up to 120 s of audio (1_323_000 samples @ 11025 Hz)
    let max_samples: usize = target_rate as usize * 120;
    let mut samples: Vec<f32> = Vec::with_capacity(max_samples);
    let mut total_duration = 0.0f64;

    'outer: for (stream, packet) in ictx.packets() {
        if stream.index() != stream_index { continue; }
        if decoder.send_packet(&packet).is_err() { continue; }
        let mut decoded = Audio::empty();
        while decoder.receive_frame(&mut decoded).is_ok() {
            let mut resampled = Audio::empty();
            if resampler.run(&decoded, &mut resampled).is_ok() {
                let data = resampled.data(0);
                let frame_samples: &[f32] = unsafe {
                    std::slice::from_raw_parts(data.as_ptr() as *const f32, data.len() / 4)
                };
                samples.extend_from_slice(frame_samples);
            }
            if let Some(pts) = decoded.pts() {
                total_duration = pts as f64 * f64::from(time_base);
            }
            if samples.len() >= max_samples { break 'outer; }
        }
    }

    if samples.is_empty() {
        return Err(napi::Error::from_reason("No audio samples decoded"));
    }

    // ── Sub-band energy fingerprint ─────────────────────────────────────────
    const FRAME_SIZE: usize = 4096;
    const HOP_SIZE: usize   = 512;
    const NUM_BANDS: usize  = 8;  // log-spaced: 0–86, 86–172, …, 2756–5512 Hz

    // Band boundaries as FFT bin indices (frame size / 2 + 1 bins, Nyquist = 5512 Hz)
    // log-spaced from 0 to FRAME_SIZE/2 over NUM_BANDS+1 points
    let nyquist_bin = FRAME_SIZE / 2;
    let band_edges: Vec<usize> = (0..=NUM_BANDS)
        .map(|i| {
            let t = i as f64 / NUM_BANDS as f64;
            // exponential spacing: bin = nyquist * (e^(t*ln(nyquist+1)) - 1) / nyquist
            let bin = ((nyquist_bin as f64 + 1.0).powf(t) - 1.0).round() as usize;
            bin.min(nyquist_bin)
        })
        .collect();

    // Collect per-frame band energies
    let num_frames = if samples.len() >= FRAME_SIZE {
        (samples.len() - FRAME_SIZE) / HOP_SIZE + 1
    } else {
        0
    };

    if num_frames < 2 {
        // Not enough audio — return a zeroed fingerprint
        return Ok(FingerprintResult {
            fingerprint: "00".repeat(32),
            duration: total_duration,
        });
    }

    let mut frame_energies: Vec<[f32; NUM_BANDS]> = Vec::with_capacity(num_frames);

    // Simple DFT magnitude per band (no windowing for speed — good enough for FP)
    for frame_idx in 0..num_frames {
        let start = frame_idx * HOP_SIZE;
        let frame = &samples[start..start + FRAME_SIZE];

        // Compute magnitude spectrum via Cooley-Tukey (iterative, in-place)
        // We only need per-band sums, so we use a lightweight approximation:
        // split frame into NUM_BANDS segments and measure RMS per segment
        // (equivalent to band-pass energy in time domain for narrow bands).
        // For a proper fingerprint we use the spectral domain below.
        let mut magnitudes = vec![0.0f32; FRAME_SIZE / 2];
        compute_dft_magnitudes(frame, &mut magnitudes);

        let mut bands = [0.0f32; NUM_BANDS];
        for b in 0..NUM_BANDS {
            let lo = band_edges[b];
            let hi = band_edges[b + 1].max(lo + 1);
            let energy: f32 = magnitudes[lo..hi.min(magnitudes.len())]
                .iter()
                .map(|&m| m * m)
                .sum();
            bands[b] = energy / (hi - lo).max(1) as f32;
        }
        frame_energies.push(bands);
    }

    // Encode: for each pair of adjacent frames, compare band energies bit by bit
    // Rising energy → 1, falling → 0. Pack 8 bits per frame pair into bytes.
    let num_bits = (frame_energies.len() - 1) * NUM_BANDS;
    let num_bytes = (num_bits + 7) / 8;
    let mut fp_bytes = vec![0u8; num_bytes];

    let mut bit_idx = 0usize;
    for f in 0..frame_energies.len() - 1 {
        for b in 0..NUM_BANDS {
            if frame_energies[f + 1][b] > frame_energies[f][b] {
                fp_bytes[bit_idx / 8] |= 1 << (bit_idx % 8);
            }
            bit_idx += 1;
        }
    }

    // Fold to 32 bytes (256 bits) by XOR-folding if longer
    let mut result = [0u8; 32];
    for (i, &byte) in fp_bytes.iter().enumerate() {
        result[i % 32] ^= byte;
    }

    let fingerprint: String = result.iter().map(|b| format!("{:02x}", b)).collect();

    Ok(FingerprintResult { fingerprint, duration: total_duration })
}

// ── DFT helper ───────────────────────────────────────────────────────────────
//
// Computes approximate magnitude spectrum using a radix-2 DIT FFT.
// Input must be FRAME_SIZE (power-of-2) samples.
// Output: FRAME_SIZE/2 magnitude values (positive frequencies only).
fn compute_dft_magnitudes(samples: &[f32], magnitudes: &mut [f32]) {
    let n = samples.len();
    if n < 2 || !n.is_power_of_two() {
        // Fallback: fill with RMS
        let rms = (samples.iter().map(|&s| s * s).sum::<f32>() / n as f32).sqrt();
        for m in magnitudes.iter_mut() { *m = rms; }
        return;
    }

    // Bit-reversal permutation
    let mut re: Vec<f32> = samples.to_vec();
    let mut im: Vec<f32> = vec![0.0; n];
    let mut j = 0usize;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if i < j {
            re.swap(i, j);
            // im is all zeros at this point so no swap needed
        }
    }

    // Cooley-Tukey iterative FFT
    let mut len = 2usize;
    while len <= n {
        let half = len / 2;
        let ang = -2.0 * std::f32::consts::PI / len as f32;
        let wr0 = ang.cos();
        let wi0 = ang.sin();
        let mut i = 0;
        while i < n {
            let (mut wr, mut wi) = (1.0f32, 0.0f32);
            for k in 0..half {
                let u_re = re[i + k];
                let u_im = im[i + k];
                let v_re = re[i + k + half] * wr - im[i + k + half] * wi;
                let v_im = re[i + k + half] * wi + im[i + k + half] * wr;
                re[i + k]        = u_re + v_re;
                im[i + k]        = u_im + v_im;
                re[i + k + half] = u_re - v_re;
                im[i + k + half] = u_im - v_im;
                let new_wr = wr * wr0 - wi * wi0;
                wi = wr * wi0 + wi * wr0;
                wr = new_wr;
            }
            i += len;
        }
        len <<= 1;
    }

    // Magnitude of positive frequencies only
    for k in 0..magnitudes.len() {
        magnitudes[k] = (re[k] * re[k] + im[k] * im[k]).sqrt();
    }
}