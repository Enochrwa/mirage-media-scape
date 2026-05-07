use napi_derive::napi;
use ffmpeg_next as ffmpeg;
use std::path::Path;
use ffmpeg::util::frame::audio::Audio;
use stratum_dsp::{analyze_audio as stratum_analyze, compute_confidence, AnalysisConfig};

#[napi(object)]
pub struct AudioMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub duration: f64,
    pub bitrate: i64,
    pub sample_rate: i32,
    pub channels: i32,
    pub format: String,
    pub loudness: Option<f64>,
    pub bpm: Option<f64>,
    pub key: Option<String>,
    pub camelot_key: Option<String>,
    pub bpm_confidence: Option<f64>,
}


#[napi]
pub fn analyze_audio(path: String) -> Result<AudioMetadata, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let mut context = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    let duration = context.duration() as f64 / ffmpeg::ffi::AV_TIME_BASE as f64;
    let bitrate = context.bit_rate();
    let format_name = context.format().name().to_string();

    let mut title = None;
    let mut artist = None;
    let mut album = None;
    let mut genre = None;
    let mut year = None;

    for (key, value) in context.metadata().iter() {
        match key.to_lowercase().as_str() {
            "title" => title = Some(value.to_string()),
            "artist" => artist = Some(value.to_string()),
            "album" => album = Some(value.to_string()),
            "genre" => genre = Some(value.to_string()),
            "date" | "year" => {
                if let Some(first_four) = value.get(0..4) {
                    year = first_four.parse::<i32>().ok();
                }
            },
            _ => {}
        }
    }

    let mut sample_rate = 0;
    let mut channels = 0;
    let mut samples_f32: Vec<f32> = Vec::with_capacity(1_000_000);

    if let Some(stream) = context.streams().best(ffmpeg::media::Type::Audio) {
        let stream_index = stream.index();
        let mut decoder = ffmpeg::codec::context::Context::from_parameters(stream.parameters())
            .map_err(|e| napi::Error::from_reason(format!("Failed to get codec context: {}", e)))?
            .decoder()
            .audio()
            .map_err(|e| napi::Error::from_reason(format!("Failed to get audio decoder: {}", e)))?;

        sample_rate = decoder.rate() as i32;
        channels = decoder.channels() as i32;

        let mut resampler = ffmpeg::software::resampling::context::Context::get(
            decoder.format(),
            decoder.channel_layout(),
            decoder.rate(),
            ffmpeg::util::format::sample::Sample::F32(ffmpeg::util::format::sample::Type::Packed),
            ffmpeg::util::channel_layout::ChannelLayout::MONO,
            decoder.rate(),
        ).map_err(|e| napi::Error::from_reason(format!("Resampler error: {}", e)))?;

        // Limit analysis to 60 seconds or first 5 million samples for speed and memory
        let max_samples = 5_000_000;

        for (stream, packet) in context.packets() {
            if stream.index() == stream_index {
                if decoder.send_packet(&packet).is_ok() {
                    let mut decoded = Audio::empty();
                    while decoder.receive_frame(&mut decoded).is_ok() {
                        let mut resampled = Audio::empty();
                        if resampler.run(&decoded, &mut resampled).is_ok() {
                            let data = resampled.data(0);
                            let samples: &[f32] = unsafe {
                                std::slice::from_raw_parts(data.as_ptr() as *const f32, data.len() / 4)
                            };
                            samples_f32.extend_from_slice(samples);
                        }
                        if samples_f32.len() >= max_samples { break; }
                    }
                }
            }
            if samples_f32.len() >= max_samples { break; }
        }
    }

    let mut loudness = None;
    let mut bpm = None;
    let mut key = None;
    let mut camelot_key = None;
    let mut bpm_confidence = None;

    if !samples_f32.is_empty() {
        // Loudness
        let sum_sq: f64 = samples_f32.iter().map(|&s| (s as f64).powi(2)).sum();
        let rms = (sum_sq / samples_f32.len() as f64).sqrt();
        let db = 20.0 * rms.log10();
        if db.is_finite() {
            loudness = Some(db);
        }

        // Stratum DSP Analysis
        if let Ok(result) = stratum_analyze(&samples_f32, sample_rate as u32, AnalysisConfig::default()) {
            bpm = Some(result.bpm as f64);
            key = Some(result.key.name());
            camelot_key = Some(result.key.numerical());
            let conf = compute_confidence(&result);
            bpm_confidence = Some(conf.bpm_confidence as f64);
        }
    }

    Ok(AudioMetadata {
        title,
        artist,
        album,
        genre,
        year,
        duration,
        bitrate,
        sample_rate,
        channels,
        format: format_name,
        loudness,
        bpm,
        key,
        camelot_key,
        bpm_confidence,
    })
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

    let mut decoder = ffmpeg::codec::context::Context::from_parameters(stream.parameters())
        .map_err(|e| napi::Error::from_reason(format!("Failed to get codec context: {}", e)))?
        .decoder()
        .audio()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get audio decoder: {}", e)))?;

    let num_buckets = 1000;
    let mut buckets = vec![0.0f32; num_buckets];
    let duration = ictx.duration() as f64 / ffmpeg::ffi::AV_TIME_BASE as f64;

    if duration <= 0.0 {
        return Ok(buckets);
    }

    // Instead of collecting all samples, we can estimate which bucket a frame belongs to
    // based on its timestamp (PTS).
    let time_base = stream.time_base();

    for (stream, packet) in ictx.packets() {
        if stream.index() == stream_index {
            decoder.send_packet(&packet).map_err(|e| napi::Error::from_reason(format!("Error sending packet: {}", e)))?;
            let mut decoded = Audio::empty();
            while decoder.receive_frame(&mut decoded).is_ok() {
                let pts = decoded.pts().unwrap_or(0) as f64 * f64::from(time_base);
                let bucket_idx = ((pts / duration) * (num_buckets as f64)) as usize;

                if bucket_idx < num_buckets {
                    let data = decoded.data(0);
                    let frame_max = data.iter().fold(0.0f32, |max, &val| {
                        let abs_val = (val as f32).abs();
                        if abs_val > max { abs_val } else { max }
                    });

                    if frame_max > buckets[bucket_idx] {
                        buckets[bucket_idx] = frame_max;
                    }
                }
            }
        }
    }

    // Normalize
    let global_max = buckets.iter().fold(0.0f32, |max, &val| if val > max { val } else { max });
    if global_max > 0.0 {
        for peak in buckets.iter_mut() {
            *peak /= global_max;
        }
    }

    Ok(buckets)
}
