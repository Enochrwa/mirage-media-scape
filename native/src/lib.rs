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

#[napi(object)]
pub struct SubtitleTrackInfo {
    pub index: u32,
    pub codec: String,
    pub language: Option<String>,
    pub title: Option<String>,
}

#[napi(object)]
pub struct TrackMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
    pub duration: f64,
    pub bitrate: i64,
    pub sample_rate: Option<i32>,
    pub channels: Option<i32>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub format: String,
    pub cover_art: Option<Vec<u8>>,
}

#[napi]
pub fn extract_metadata(path: String) -> Result<TrackMetadata, napi::Error> {
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
    let mut track_number = None;
    let mut disc_number = None;

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
            "track" => {
                track_number = value.split('/').next().and_then(|s| s.parse::<i32>().ok());
            },
            "disc" => {
                disc_number = value.split('/').next().and_then(|s| s.parse::<i32>().ok());
            },
            _ => {}
        }
    }

    let mut sample_rate = None;
    let mut channels = None;
    let mut width = None;
    let mut height = None;
    let mut cover_art = None;

    for stream in context.streams() {
        match stream.parameters().medium() {
            ffmpeg::media::Type::Audio => {
                if sample_rate.is_none() {
                    if let Ok(codec_ctx) = ffmpeg::codec::context::Context::from_parameters(stream.parameters()) {
                        if let Ok(audio) = codec_ctx.decoder().audio() {
                            sample_rate = Some(audio.rate() as i32);
                            channels = Some(audio.channels() as i32);
                        }
                    }
                }
            },
            ffmpeg::media::Type::Video => {
                if stream.disposition().contains(ffmpeg::format::stream::Disposition::ATTACHED_PIC) {
                    // Extract cover art
                    // For attached pictures, the data is in the first packet of the stream
                    let mut ictx = ffmpeg::format::input(&path_buf).unwrap();
                    let stream_index = stream.index();
                    for (s, packet) in ictx.packets() {
                        if s.index() == stream_index {
                            cover_art = Some(packet.data().unwrap().to_vec());
                            break;
                        }
                    }
                } else if width.is_none() {
                    if let Ok(codec_ctx) = ffmpeg::codec::context::Context::from_parameters(stream.parameters()) {
                        if let Ok(video) = codec_ctx.decoder().video() {
                            width = Some(video.width() as i32);
                            height = Some(video.height() as i32);
                        }
                    }
                }
            },
            _ => {}
        }
    }

    Ok(TrackMetadata {
        title,
        artist,
        album,
        genre,
        year,
        track_number,
        disc_number,
        duration,
        bitrate,
        sample_rate,
        channels,
        width,
        height,
        format: format_name,
        cover_art,
    })
}

#[napi]
pub fn generate_thumbnail(path: String, time_seconds: f64, output_path: String) -> Result<(), napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let mut context = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    let stream = context.streams().best(ffmpeg::media::Type::Video)
        .ok_or_else(|| napi::Error::from_reason("No video stream found"))?;

    let stream_index = stream.index();
    let context_parameters = stream.parameters();
    let mut decoder = ffmpeg::codec::context::Context::from_parameters(context_parameters)
        .map_err(|e| napi::Error::from_reason(format!("Failed to get codec context: {}", e)))?
        .decoder()
        .video()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get video decoder: {}", e)))?;

    let position = (time_seconds * ffmpeg::ffi::AV_TIME_BASE as f64) as i64;
    context.seek(position, ..position).map_err(|e| napi::Error::from_reason(format!("Seek error: {}", e)))?;

    let mut scaler = ffmpeg::software::scaling::context::Context::get(
        decoder.format(),
        decoder.width(),
        decoder.height(),
        ffmpeg::util::format::Pixel::RGB24,
        decoder.width(),
        decoder.height(),
        ffmpeg::software::scaling::flag::Flags::BILINEAR,
    ).map_err(|e| napi::Error::from_reason(format!("Scaler error: {}", e)))?;

    let mut frame_decoded = ffmpeg::util::frame::Video::empty();
    let mut thumbnail_generated = false;

    for (stream, packet) in context.packets() {
        if stream.index() == stream_index {
            if decoder.send_packet(&packet).is_ok() {
                if decoder.receive_frame(&mut frame_decoded).is_ok() {
                    let mut frame_rgb = ffmpeg::util::frame::Video::empty();
                    scaler.run(&frame_decoded, &mut frame_rgb).map_err(|e| napi::Error::from_reason(format!("Scaling error: {}", e)))?;

                    // Save as JPEG - using a simple approach for now, maybe we should use a proper JPEG encoder
                    // Since I don't have an easy way to write JPEG from raw RGB here without adding a dependency
                    // and I'm not allowed to add dependencies easily if I can avoid it.
                    // Wait, I can use FFmpeg to encode to JPEG!

                    let codec = ffmpeg::encoder::find(ffmpeg::codec::Id::MJPEG)
                        .ok_or_else(|| napi::Error::from_reason("MJPEG encoder not found"))?;

                    let mut encoder_ctx = ffmpeg::codec::context::Context::new();
                    let mut encoder = encoder_ctx.encoder().video()
                        .map_err(|_| napi::Error::from_reason("Failed to get video encoder"))?;

                    encoder.set_width(decoder.width());
                    encoder.set_height(decoder.height());
                    encoder.set_format(ffmpeg::util::format::Pixel::YUVJ420P);
                    encoder.set_time_base(ffmpeg_next::Rational(1, 25));

                    let mut encoder = encoder.open_as(codec).map_err(|e| napi::Error::from_reason(format!("Failed to open encoder: {}", e)))?;

                    let mut sws = ffmpeg::software::scaling::context::Context::get(
                        ffmpeg::util::format::Pixel::RGB24,
                        decoder.width(),
                        decoder.height(),
                        ffmpeg::util::format::Pixel::YUVJ420P,
                        decoder.width(),
                        decoder.height(),
                        ffmpeg::software::scaling::flag::Flags::BILINEAR,
                    ).map_err(|e| napi::Error::from_reason(format!("Scaler error: {}", e)))?;

                    let mut frame_j = ffmpeg::util::frame::Video::empty();
                    sws.run(&frame_rgb, &mut frame_j).map_err(|e| napi::Error::from_reason(format!("Scaling error: {}", e)))?;

                    let mut packet = ffmpeg::Packet::empty();
                    if encoder.send_frame(&frame_j).is_ok() {
                        if encoder.receive_packet(&mut packet).is_ok() {
                            std::fs::write(output_path, packet.data().unwrap()).map_err(|e| napi::Error::from_reason(format!("Failed to write file: {}", e)))?;
                            thumbnail_generated = true;
                            break;
                        }
                    }
                }
            }
        }
    }

    if !thumbnail_generated {
        return Err(napi::Error::from_reason("Failed to generate thumbnail"));
    }

    Ok(())
}

#[napi]
pub fn get_subtitle_tracks(path: String) -> Result<Vec<SubtitleTrackInfo>, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let context = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    let mut tracks = Vec::new();
    for stream in context.streams() {
        if stream.parameters().medium() == ffmpeg::media::Type::Subtitle {
            let mut language = None;
            let mut title = None;

            for (key, value) in stream.metadata().iter() {
                match key.to_lowercase().as_str() {
                    "language" => language = Some(value.to_string()),
                    "title" => title = Some(value.to_string()),
                    _ => {}
                }
            }

            tracks.push(SubtitleTrackInfo {
                index: stream.index() as u32,
                codec: stream.parameters().id().name().to_string(),
                language,
                title,
            });
        }
    }

    Ok(tracks)
}

#[napi]
pub fn extract_subtitle_stream(path: String, stream_index: u32) -> Result<String, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let mut context = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    let stream = context.streams().best(ffmpeg::media::Type::Subtitle)
        .ok_or_else(|| napi::Error::from_reason(format!("Subtitle stream not found")))?;

    if stream.parameters().medium() != ffmpeg::media::Type::Subtitle {
        return Err(napi::Error::from_reason("Stream is not a subtitle stream"));
    }

    // This is a simplified extraction - many subtitle formats are text-based
    // For bitmapped subtitles, this would return garbage.
    let mut result = String::new();
    for (s, packet) in context.packets() {
        if s.index() == stream_index as usize {
            if let Some(data) = packet.data() {
                result.push_str(&String::from_utf8_lossy(data));
            }
        }
    }

    Ok(result)
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

    // Target: 8000 Hz, Mono
    let mut resampler = ffmpeg::software::resampling::context::Context::get(
        decoder.format(),
        decoder.channel_layout(),
        decoder.rate(),
        ffmpeg::util::format::sample::Sample::F32(ffmpeg::util::format::sample::Type::Packed),
        ffmpeg::util::channel_layout::ChannelLayout::MONO,
        8000,
    ).map_err(|e| napi::Error::from_reason(format!("Resampler error: {}", e)))?;

    let mut samples: Vec<f32> = Vec::with_capacity(480_000); // 60s * 8000Hz
    let max_samples = 480_000;

    for (stream, packet) in ictx.packets() {
        if stream.index() == stream_index {
            if decoder.send_packet(&packet).is_ok() {
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
                    if samples.len() >= max_samples { break; }
                }
            }
        }
        if samples.len() >= max_samples { break; }
    }

    if samples.is_empty() {
        return Err(napi::Error::from_reason("No audio samples decoded"));
    }

    // Compute 32 RMS energy values across equal-time windows
    let window_size = samples.len() / 32;
    let mut fingerprint = String::with_capacity(32);

    for i in 0..32 {
        let start = i * window_size;
        let end = if i == 31 { samples.len() } else { (i + 1) * window_size };
        let window = &samples[start..end];

        let sum_sq: f32 = window.iter().map(|&s| s * s).sum();
        let rms = (sum_sq / window.len() as f32).sqrt();

        // Normalize to 0-255 (scaled by a factor, RMS of 1.0 is full scale)
        let normalized = (rms * 255.0).min(255.0) as u8;
        fingerprint.push_str(&format!("{:02x}", normalized));
    }

    Ok(fingerprint)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_metadata_invalid_path() {
        // We expect an error when the path is invalid
        let result = extract_metadata("non_existent_file.mp3".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_get_subtitle_tracks_invalid_path() {
        let result = get_subtitle_tracks("non_existent_file.mkv".to_string());
        assert!(result.is_err());
    }
}
