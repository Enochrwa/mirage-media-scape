use napi_derive::napi;
use ffmpeg_next as ffmpeg;
use std::path::Path;
use ffmpeg::util::frame::audio::Audio;

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
}

#[napi]
pub fn analyze_audio(path: String) -> Result<AudioMetadata, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let context = ffmpeg::format::input(&path_buf)
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

    for stream in context.streams() {
        let params = stream.parameters();
        if params.medium() == ffmpeg::media::Type::Audio {
            if let Ok(codec_context) = ffmpeg::codec::context::Context::from_parameters(params) {
                if let Ok(audio) = codec_context.decoder().audio() {
                    sample_rate = audio.rate() as i32;
                    channels = audio.channels() as i32;
                }
            }
        }
    }

    // Calculate a rough loudness (RMS to dBFS)
    // In a production environment, we would use a proper EBU R128 filter
    let mut loudness = None;
    let mut sum_sq = 0.0f64;
    let mut count = 0usize;

    if let Some(stream) = context.streams().best(ffmpeg::media::Type::Audio) {
        let stream_index = stream.index();
        let mut decoder = ffmpeg::codec::context::Context::from_parameters(stream.parameters())
            .map_err(|e| napi::Error::from_reason(format!("Failed to get codec context: {}", e)))?
            .decoder()
            .audio()
            .map_err(|e| napi::Error::from_reason(format!("Failed to get audio decoder: {}", e)))?;

        // We'll analyze the first 30 seconds for a quick integrated loudness estimate
        let max_analyze_duration = 30.0;
        let time_base = stream.time_base();

        for (stream, packet) in context.packets() {
            if stream.index() == stream_index {
                if let Ok(_) = decoder.send_packet(&packet) {
                    let mut decoded = Audio::empty();
                    while decoder.receive_frame(&mut decoded).is_ok() {
                        let pts = decoded.pts().unwrap_or(0) as f64 * f64::from(time_base);

                        // Get samples and calculate energy
                        // We use the decoded data based on its format.
                        // FFmpeg-next's Audio frame provides data in planes.
                        // For simplicity and speed, we only look at the first plane.
                        let format = decoded.format();
                        let data = decoded.data(0);

                        match format {
                            ffmpeg::util::format::sample::Sample::F32(ffmpeg::util::format::sample::Type::Packed) |
                            ffmpeg::util::format::sample::Sample::F32(ffmpeg::util::format::sample::Type::Planar) => {
                                let samples: &[f32] = unsafe {
                                    std::slice::from_raw_parts(data.as_ptr() as *const f32, data.len() / 4)
                                };
                                for &s in samples {
                                    sum_sq += (s as f64).powi(2);
                                    count += 1;
                                }
                            }
                            ffmpeg::util::format::sample::Sample::I16(ffmpeg::util::format::sample::Type::Packed) |
                            ffmpeg::util::format::sample::Sample::I16(ffmpeg::util::format::sample::Type::Planar) => {
                                let samples: &[i16] = unsafe {
                                    std::slice::from_raw_parts(data.as_ptr() as *const i16, data.len() / 2)
                                };
                                for &s in samples {
                                    let s_f = s as f64 / 32768.0;
                                    sum_sq += s_f.powi(2);
                                    count += 1;
                                }
                            }
                            _ => {
                                // Fallback for other formats: treat as bytes but don't do the wrong math
                                // Ideally use a resampler here.
                            }
                        }

                        if pts > max_analyze_duration {
                            break;
                        }
                    }
                }
            }
            if count > 1_000_000 { break; }
        }

        if count > 0 {
            let rms = (sum_sq / count as f64).sqrt();
            let db = 20.0 * rms.log10();
            if db.is_finite() {
                loudness = Some(db);
            }
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
