use napi_derive::napi;
use ffmpeg_next as ffmpeg;
use std::path::Path;
use ffmpeg::util::frame::audio::Audio;

#[napi(object)]
pub struct FingerprintResult {
    pub fingerprint: String,
    pub duration: f64,
}

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
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to get audio decoder: {}", e))
        })?;

    // Resample to mono f32 for consistent amplitude measurement
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
    // Use duration from container; fall back to stream duration
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

    // Accumulate RMS sum-of-squares and counts per bucket
    let mut bucket_sum_sq = vec![0.0f64; num_buckets];
    let mut bucket_counts = vec![0usize; num_buckets];

    for (stream, packet) in ictx.packets() {
        if stream.index() != stream_index {
            continue;
        }
        if decoder.send_packet(&packet).is_err() {
            continue;
        }
        let mut decoded = Audio::empty();
        while decoder.receive_frame(&mut decoded).is_ok() {
            let pts_secs = decoded.pts().unwrap_or(0) as f64 * f64::from(time_base);
            let bucket_idx = ((pts_secs / duration_secs) * num_buckets as f64) as usize;
            let bucket_idx = bucket_idx.min(num_buckets - 1);

            let mut resampled = Audio::empty();
            if resampler.run(&decoded, &mut resampled).is_ok() {
                let data = resampled.data(0);
                // SAFETY: F32 Packed layout
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

    // Convert sum-of-squares to RMS per bucket
    let mut buckets: Vec<f32> = bucket_sum_sq
        .iter()
        .zip(bucket_counts.iter())
        .map(|(&sq, &cnt)| {
            if cnt > 0 {
                (sq / cnt as f64).sqrt() as f32
            } else {
                0.0f32
            }
        })
        .collect();

    // Normalise to [0, 1]
    let global_max = buckets.iter().cloned().fold(0.0f32, f32::max);
    if global_max > 0.0 {
        for peak in buckets.iter_mut() {
            *peak /= global_max;
        }
    }

    Ok(buckets)
}

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
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to get audio decoder: {}", e))
        })?;

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
    let max_samples = 480_000; // 60 s × 8 000 Hz

    'outer: for (stream, packet) in ictx.packets() {
        if stream.index() != stream_index {
            continue;
        }
        if decoder.send_packet(&packet).is_err() {
            continue;
        }
        let mut decoded = Audio::empty();
        while decoder.receive_frame(&mut decoded).is_ok() {
            let mut resampled = Audio::empty();
            if resampler.run(&decoded, &mut resampled).is_ok() {
                let data = resampled.data(0);
                // SAFETY: F32 Packed layout
                let frame_samples: &[f32] = unsafe {
                    std::slice::from_raw_parts(data.as_ptr() as *const f32, data.len() / 4)
                };
                samples.extend_from_slice(frame_samples);
            }
            if samples.len() >= max_samples {
                break 'outer;
            }
        }
    }

    if samples.is_empty() {
        return Err(napi::Error::from_reason("No audio samples decoded"));
    }

    // 32 RMS energy windows → 64-char hex fingerprint
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
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to get audio decoder: {}", e))
        })?;

    // Chromaprint requires 16-bit signed integer samples at 11025 Hz, mono.
    let target_rate: u32 = 11025;
    let target_channels: i32 = 1;

    let mut resampler = ffmpeg::software::resampling::context::Context::get(
        decoder.format(),
        decoder.channel_layout(),
        decoder.rate(),
        ffmpeg::util::format::sample::Sample::I16(ffmpeg::util::format::sample::Type::Packed),
        ffmpeg::util::channel_layout::ChannelLayout::MONO,
        target_rate,
    )
    .map_err(|e| napi::Error::from_reason(format!("Resampler error: {}", e)))?;

    let mut chromaprint_ctx = chromaprint::Chromaprint::new();
    chromaprint_ctx.start(target_rate as i32, target_channels);

    let mut total_duration = 0.0f64;

    'outer: for (stream, packet) in ictx.packets() {
        if stream.index() != stream_index {
            continue;
        }
        if decoder.send_packet(&packet).is_err() {
            continue;
        }
        let mut decoded = Audio::empty();
        while decoder.receive_frame(&mut decoded).is_ok() {
            let mut resampled = Audio::empty();
            if resampler.run(&decoded, &mut resampled).is_ok() {
                let data: &[u8] = resampled.data(0);
                // Feed samples to chromaprint (expects &[u8] in this crate version,
                // but we must ensure correct interpretation or cast if it expects samples)
                // The error says it expects &[u8] but we passed &[i16]?
                // Wait, in my previous attempt it said: expected `&[u8]`, found `&[i16]`
                // So I should pass data directly which is &[u8].
                chromaprint_ctx.feed(data);
            }
            if let Some(pts) = decoded.pts() {
                total_duration = pts as f64 * f64::from(time_base);
            }
            if total_duration >= 120.0 {
                break 'outer;
            }
        }
    }

    chromaprint_ctx.finish();
    let fingerprint = chromaprint_ctx
        .fingerprint()
        .unwrap_or_else(|| "error".to_string());

    Ok(FingerprintResult {
        fingerprint,
        duration: total_duration,
    })
}
