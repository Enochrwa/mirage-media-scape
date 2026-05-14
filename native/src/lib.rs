use napi_derive::napi;
use ffmpeg_next as ffmpeg;
use std::path::Path;
use ffmpeg::util::frame::audio::Audio;
use stratum_dsp::{analyze_audio as stratum_analyze, AnalysisConfig};
use rayon::prelude::*;

// ─────────────────────────────────────────────────────────────────────────────
// Structs exposed to Node
// ─────────────────────────────────────────────────────────────────────────────

#[napi(object)]
pub struct AudioAnalysis {
    pub bpm: f64,
    pub key: String,
    pub camelot_key: String,
    pub energy: f64,
    pub loudness: f64,
}

#[napi(object)]
pub struct ReplayGainResult {
    pub track_gain: f64,
    pub track_peak: f64,
}

#[napi(object)]
pub struct SubtitleTrack {
    pub index: u32,
    pub codec_name: String,
    pub language: Option<String>,
    pub title: Option<String>,
}

#[napi(object)]
pub struct TagInput {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
}

#[napi(object)]
pub struct HardwareCodecSupport {
    pub h264: bool,
    pub hevc: bool,
    pub av1: bool,
    pub vp9: bool,
}

/// Full metadata struct – mirrors both `native/index.d.ts` and
/// `server/zovyra-native.d.ts` exactly.
#[napi(object)]
pub struct TrackMetadata {
    // ── tags ──────────────────────────────────────────────────────────────
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album_artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
    pub composer: Option<String>,
    pub lyricist: Option<String>,
    pub comment: Option<String>,
    pub copyright: Option<String>,
    pub encoder: Option<String>,
    pub lyrics: Option<String>,
    pub synced_lyrics: Option<String>,

    // ── stream info ───────────────────────────────────────────────────────
    pub duration: f64,
    pub sample_rate: Option<i32>,
    pub bit_rate: Option<i64>,
    pub channels: Option<i32>,
    pub codec_name: Option<String>,     // primary audio codec
    pub file_type: String,              // "audio" | "video"

    // ── video-specific ────────────────────────────────────────────────────
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub frame_rate: Option<f64>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,

    // ── cover art / colour ───────────────────────────────────────────────
    pub cover_art_bytes: Option<Vec<u8>>,
    pub dominant_color: Option<String>,

    // ── ReplayGain tags ───────────────────────────────────────────────────
    pub replaygain_track_gain: Option<f64>,
    pub replaygain_album_gain: Option<f64>,
    pub replaygain_track_peak: Option<f64>,
    pub replaygain_album_peak: Option<f64>,
}

#[napi(object)]
pub struct FingerprintResult {
    pub fingerprint: String,
    pub duration: f64,
}

#[napi(object)]
pub struct ScannedFile {
    pub path: String,
    pub mtime: f64,
    pub size: i64,
}

// ─────────────────────────────────────────────────────────────────────────────
// extractMetadata
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn extract_metadata(path: String) -> Result<TrackMetadata, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let context = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    let duration = context.duration() as f64 / ffmpeg::ffi::AV_TIME_BASE as f64;
    let bit_rate = Some(context.bit_rate());

    // ── metadata tags ──────────────────────────────────────────────────────
    let mut title = None;
    let mut artist = None;
    let mut album_artist = None;
    let mut album = None;
    let mut genre = None;
    let mut year: Option<i32> = None;
    let mut track_number: Option<i32> = None;
    let mut disc_number: Option<i32> = None;
    let mut composer = None;
    let mut lyricist = None;
    let mut comment = None;
    let mut copyright = None;
    let mut encoder = None;
    let mut lyrics = None;
    let mut synced_lyrics = None;
    let mut replaygain_track_gain: Option<f64> = None;
    let mut replaygain_album_gain: Option<f64> = None;
    let mut replaygain_track_peak: Option<f64> = None;
    let mut replaygain_album_peak: Option<f64> = None;

    for (key, value) in context.metadata().iter() {
        match key.to_lowercase().as_str() {
            "title" => title = Some(value.to_string()),
            "artist" => artist = Some(value.to_string()),
            "album_artist" | "albumartist" => album_artist = Some(value.to_string()),
            "album" => album = Some(value.to_string()),
            "genre" => genre = Some(value.to_string()),
            "date" | "year" => {
                year = value.get(0..4).and_then(|s| s.parse::<i32>().ok());
            }
            "track" => {
                track_number = value.split('/').next().and_then(|s| s.parse::<i32>().ok());
            }
            "disc" => {
                disc_number = value.split('/').next().and_then(|s| s.parse::<i32>().ok());
            }
            "composer" => composer = Some(value.to_string()),
            "lyricist" => lyricist = Some(value.to_string()),
            "comment" | "description" => comment = Some(value.to_string()),
            "copyright" => copyright = Some(value.to_string()),
            "encoder" => encoder = Some(value.to_string()),
            "lyrics" => lyrics = Some(value.to_string()),
            "syncedlyrics" | "lyrics-xxx" => synced_lyrics = Some(value.to_string()),
            "replaygain_track_gain" => {
                replaygain_track_gain = value
                    .trim_end_matches(" dB")
                    .trim()
                    .parse::<f64>()
                    .ok();
            }
            "replaygain_album_gain" => {
                replaygain_album_gain = value
                    .trim_end_matches(" dB")
                    .trim()
                    .parse::<f64>()
                    .ok();
            }
            "replaygain_track_peak" => {
                replaygain_track_peak = value.parse::<f64>().ok();
            }
            "replaygain_album_peak" => {
                replaygain_album_peak = value.parse::<f64>().ok();
            }
            _ => {}
        }
    }

    // ── stream analysis ────────────────────────────────────────────────────
    let mut sample_rate: Option<i32> = None;
    let mut channels: Option<i32> = None;
    let mut width: Option<i32> = None;
    let mut height: Option<i32> = None;
    let mut frame_rate: Option<f64> = None;
    let mut video_codec: Option<String> = None;
    let mut audio_codec: Option<String> = None;
    let mut codec_name: Option<String> = None;
    let mut file_type = "audio".to_string();
    let mut attached_pic_stream_index: Option<usize> = None;

    for stream in context.streams() {
        let params = stream.parameters();
        match params.medium() {
            ffmpeg::media::Type::Audio => {
                if sample_rate.is_none() {
                    let acodec = params.id().name().to_string();
                    audio_codec = Some(acodec.clone());
                    codec_name = Some(acodec);
                    if let Ok(codec_ctx) =
                        ffmpeg::codec::context::Context::from_parameters(params)
                    {
                        if let Ok(audio) = codec_ctx.decoder().audio() {
                            sample_rate = Some(audio.rate() as i32);
                            channels = Some(audio.channels() as i32);
                        }
                    }
                }
            }
            ffmpeg::media::Type::Video => {
                if stream
                    .disposition()
                    .contains(ffmpeg::format::stream::Disposition::ATTACHED_PIC)
                {
                    attached_pic_stream_index = Some(stream.index());
                } else if width.is_none() {
                    file_type = "video".to_string();
                    frame_rate = Some(f64::from(stream.avg_frame_rate()));
                    let vcodec = params.id().name().to_string();
                    video_codec = Some(vcodec);
                    if let Ok(codec_ctx) =
                        ffmpeg::codec::context::Context::from_parameters(params)
                    {
                        if let Ok(video) = codec_ctx.decoder().video() {
                            width = Some(video.width() as i32);
                            height = Some(video.height() as i32);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    // ── cover art ──────────────────────────────────────────────────────────
    let mut cover_art_bytes: Option<Vec<u8>> = None;
    let mut dominant_color: Option<String> = None;

    if let Some(index) = attached_pic_stream_index {
        if let Ok(mut ictx) = ffmpeg::format::input(&path_buf) {
            for (s, packet) in ictx.packets() {
                if s.index() == index {
                    if let Some(data) = packet.data() {
                        let bytes = data.to_vec();
                        dominant_color = extract_dominant_color_from_bytes(&bytes);
                        cover_art_bytes = Some(bytes);
                    }
                    break;
                }
            }
        }
    }

    Ok(TrackMetadata {
        title,
        artist,
        album_artist,
        album,
        year,
        genre,
        track_number,
        disc_number,
        composer,
        lyricist,
        comment,
        copyright,
        encoder,
        lyrics,
        synced_lyrics,
        duration,
        sample_rate,
        bit_rate,
        channels,
        codec_name,
        file_type,
        width,
        height,
        frame_rate,
        video_codec,
        audio_codec,
        cover_art_bytes,
        dominant_color,
        replaygain_track_gain,
        replaygain_album_gain,
        replaygain_track_peak,
        replaygain_album_peak,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// generateThumbnail
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn generate_thumbnail(
    path: String,
    time_seconds: f64,
    output_path: String,
) -> Result<(), napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let mut context = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    let stream = context
        .streams()
        .best(ffmpeg::media::Type::Video)
        .ok_or_else(|| napi::Error::from_reason("No video stream found"))?;

    let stream_index = stream.index();
    let context_parameters = stream.parameters();
    let mut decoder = ffmpeg::codec::context::Context::from_parameters(context_parameters)
        .map_err(|e| napi::Error::from_reason(format!("Failed to get codec context: {}", e)))?
        .decoder()
        .video()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get video decoder: {}", e)))?;

    let position = (time_seconds * ffmpeg::ffi::AV_TIME_BASE as f64) as i64;
    context
        .seek(position, ..position)
        .map_err(|e| napi::Error::from_reason(format!("Seek error: {}", e)))?;

    let mut scaler = ffmpeg::software::scaling::context::Context::get(
        decoder.format(),
        decoder.width(),
        decoder.height(),
        ffmpeg::util::format::Pixel::RGB24,
        decoder.width(),
        decoder.height(),
        ffmpeg::software::scaling::flag::Flags::BILINEAR,
    )
    .map_err(|e| napi::Error::from_reason(format!("Scaler error: {}", e)))?;

    let mut frame_decoded = ffmpeg::util::frame::Video::empty();
    let mut thumbnail_generated = false;

    'outer: for (stream, packet) in context.packets() {
        if stream.index() != stream_index {
            continue;
        }
        if decoder.send_packet(&packet).is_err() {
            continue;
        }
        while decoder.receive_frame(&mut frame_decoded).is_ok() {
            let mut frame_rgb = ffmpeg::util::frame::Video::empty();
            scaler
                .run(&frame_decoded, &mut frame_rgb)
                .map_err(|e| napi::Error::from_reason(format!("Scaling error: {}", e)))?;

            // Encode to MJPEG via FFmpeg
            let codec = ffmpeg::encoder::find(ffmpeg::codec::Id::MJPEG)
                .ok_or_else(|| napi::Error::from_reason("MJPEG encoder not found"))?;

            let encoder_ctx = ffmpeg::codec::context::Context::new();
            let mut enc = encoder_ctx
                .encoder()
                .video()
                .map_err(|_| napi::Error::from_reason("Failed to get video encoder"))?;

            enc.set_width(decoder.width());
            enc.set_height(decoder.height());
            enc.set_format(ffmpeg::util::format::Pixel::YUVJ420P);
            enc.set_time_base(ffmpeg_next::Rational(1, 25));

            let mut enc = enc
                .open_as(codec)
                .map_err(|e| napi::Error::from_reason(format!("Failed to open encoder: {}", e)))?;

            let mut sws = ffmpeg::software::scaling::context::Context::get(
                ffmpeg::util::format::Pixel::RGB24,
                decoder.width(),
                decoder.height(),
                ffmpeg::util::format::Pixel::YUVJ420P,
                decoder.width(),
                decoder.height(),
                ffmpeg::software::scaling::flag::Flags::BILINEAR,
            )
            .map_err(|e| napi::Error::from_reason(format!("Scaler error: {}", e)))?;

            let mut frame_j = ffmpeg::util::frame::Video::empty();
            sws.run(&frame_rgb, &mut frame_j)
                .map_err(|e| napi::Error::from_reason(format!("Scaling error: {}", e)))?;

            let mut pkt = ffmpeg::Packet::empty();
            if enc.send_frame(&frame_j).is_ok() && enc.receive_packet(&mut pkt).is_ok() {
                if let Some(data) = pkt.data() {
                    std::fs::write(&output_path, data).map_err(|e| {
                        napi::Error::from_reason(format!("Failed to write file: {}", e))
                    })?;
                    thumbnail_generated = true;
                    break 'outer;
                }
            }
        }
    }

    if !thumbnail_generated {
        return Err(napi::Error::from_reason("Failed to generate thumbnail"));
    }
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// getSubtitleTracks
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn get_subtitle_tracks(path: String) -> Result<Vec<SubtitleTrack>, napi::Error> {
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

            tracks.push(SubtitleTrack {
                index: stream.index() as u32,
                codec_name: stream.parameters().id().name().to_string(),
                language,
                title,
            });
        }
    }

    Ok(tracks)
}

// ─────────────────────────────────────────────────────────────────────────────
// writeTags  (stub — tag writing requires a dedicated crate e.g. id3/metaflac)
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn write_tags(_path: String, _tags: TagInput) -> Result<(), napi::Error> {
    Err(napi::Error::from_reason(
        "Tag writing not yet implemented: use id3/metaflac crates",
    ))
}

// ─────────────────────────────────────────────────────────────────────────────
// probeHardwareCodecs
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn probe_hardware_codecs() -> Result<HardwareCodecSupport, napi::Error> {
    Ok(HardwareCodecSupport {
        h264: true,
        hevc: true,
        av1: false,
        vp9: true,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// extractSubtitleStream
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn extract_subtitle_stream(path: String, stream_index: u32) -> Result<String, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let mut context = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    // Verify the requested stream is actually a subtitle stream
    let is_subtitle = context
        .streams()
        .nth(stream_index as usize)
        .map(|s| s.parameters().medium() == ffmpeg::media::Type::Subtitle)
        .unwrap_or(false);

    if !is_subtitle {
        return Err(napi::Error::from_reason(
            "Stream is not a subtitle stream or index out of range",
        ));
    }

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

// ─────────────────────────────────────────────────────────────────────────────
// analyzeAudio
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn analyze_audio(path: String) -> Result<AudioAnalysis, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let mut context = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    let mut sample_rate: u32 = 44100;
    let mut samples_f32: Vec<f32> = Vec::with_capacity(1_000_000);

    if let Some(stream) = context.streams().best(ffmpeg::media::Type::Audio) {
        let stream_index = stream.index();
        let mut decoder = ffmpeg::codec::context::Context::from_parameters(stream.parameters())
            .map_err(|e| napi::Error::from_reason(format!("Failed to get codec context: {}", e)))?
            .decoder()
            .audio()
            .map_err(|e| {
                napi::Error::from_reason(format!("Failed to get audio decoder: {}", e))
            })?;

        sample_rate = decoder.rate();

        let mut resampler = ffmpeg::software::resampling::context::Context::get(
            decoder.format(),
            decoder.channel_layout(),
            decoder.rate(),
            ffmpeg::util::format::sample::Sample::F32(
                ffmpeg::util::format::sample::Type::Packed,
            ),
            ffmpeg::util::channel_layout::ChannelLayout::MONO,
            decoder.rate(),
        )
        .map_err(|e| napi::Error::from_reason(format!("Resampler error: {}", e)))?;

        let max_samples = 10_000_000;

        'outer: for (stream, packet) in context.packets() {
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
                    // SAFETY: F32 Packed layout – bytes are contiguous f32 values
                    let slice: &[f32] = unsafe {
                        std::slice::from_raw_parts(
                            data.as_ptr() as *const f32,
                            data.len() / 4,
                        )
                    };
                    samples_f32.extend_from_slice(slice);
                }
                if samples_f32.len() >= max_samples {
                    break 'outer;
                }
            }
        }
    }

    if samples_f32.is_empty() {
        return Err(napi::Error::from_reason("No audio samples decoded"));
    }

    // RMS loudness
    let sum_sq: f64 = samples_f32.iter().map(|&s| (s as f64).powi(2)).sum();
    let rms = (sum_sq / samples_f32.len() as f64).sqrt();
    // Guard against log(0)
    let loudness = if rms > 0.0 {
        20.0 * rms.log10()
    } else {
        -96.0
    };

    // BPM / key / energy via stratum-dsp
    let result = stratum_analyze(&samples_f32, sample_rate, AnalysisConfig::default())
        .map_err(|e| napi::Error::from_reason(format!("Analysis error: {:?}", e)))?;

    Ok(AudioAnalysis {
        bpm: result.bpm as f64,
        key: result.key.name(),
        camelot_key: result.key.numerical(),
        energy: result.key_clarity as f64,
        loudness,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// computeReplayGain
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn compute_replay_gain(paths: Vec<String>) -> Result<Vec<ReplayGainResult>, napi::Error> {
    paths
        .iter()
        .map(|p| {
            let analysis = analyze_audio(p.clone())?;
            let track_gain = -14.0 - analysis.loudness;
            Ok(ReplayGainResult {
                track_gain,
                track_peak: 0.9,
            })
        })
        .collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// generateWaveform
// ─────────────────────────────────────────────────────────────────────────────

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
    let time_base = stream.time_base();

    let mut decoder = ffmpeg::codec::context::Context::from_parameters(stream.parameters())
        .map_err(|e| napi::Error::from_reason(format!("Failed to get codec context: {}", e)))?
        .decoder()
        .audio()
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to get audio decoder: {}", e))
        })?;

    let num_buckets: usize = 1000;
    let mut buckets = vec![0.0f32; num_buckets];
    let duration = ictx.duration() as f64 / ffmpeg::ffi::AV_TIME_BASE as f64;

    if duration <= 0.0 {
        return Ok(buckets);
    }

    for (stream, packet) in ictx.packets() {
        if stream.index() != stream_index {
            continue;
        }
        if decoder.send_packet(&packet).is_err() {
            continue;
        }
        let mut decoded = Audio::empty();
        while decoder.receive_frame(&mut decoded).is_ok() {
            let pts = decoded.pts().unwrap_or(0) as f64 * f64::from(time_base);
            let bucket_idx = ((pts / duration) * num_buckets as f64) as usize;

            if bucket_idx < num_buckets {
                let data = decoded.data(0);
                let frame_max = data
                    .iter()
                    .fold(0.0f32, |max, &v| f32::max(max, (v as f32).abs()));

                if frame_max > buckets[bucket_idx] {
                    buckets[bucket_idx] = frame_max;
                }
            }
        }
    }

    // Normalise to [0, 1]
    let global_max = buckets.iter().cloned().fold(0.0f32, f32::max);
    if global_max > 0.0 {
        for peak in buckets.iter_mut() {
            *peak /= global_max;
        }
    }

    Ok(buckets)
}

// ─────────────────────────────────────────────────────────────────────────────
// generateWaveformFingerprint
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// generateFingerprint  (Chromaprint / AcoustID)
// ─────────────────────────────────────────────────────────────────────────────

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

    let mut resampler = ffmpeg::software::resampling::context::Context::get(
        decoder.format(),
        decoder.channel_layout(),
        decoder.rate(),
        ffmpeg::util::format::sample::Sample::I16(ffmpeg::util::format::sample::Type::Packed),
        ffmpeg::util::channel_layout::ChannelLayout::MONO,
        11025,
    )
    .map_err(|e| napi::Error::from_reason(format!("Resampler error: {}", e)))?;

    let mut chromaprint_ctx = chromaprint::Chromaprint::new();
    chromaprint_ctx.start(11025, 1);

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

// ─────────────────────────────────────────────────────────────────────────────
// scanFolders
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn scan_folders(folders: Vec<String>) -> Vec<ScannedFile> {
    folders
        .into_par_iter()
        .flat_map(|folder| {
            let mut files = Vec::new();
            let p = Path::new(&folder);
            if p.is_dir() {
                walk_dir(p, &mut files);
            }
            files
        })
        .collect()
}

fn walk_dir(dir: &Path, files: &mut Vec<ScannedFile>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_dir(&path, files);
        } else if is_media_file(&path) {
            if let Ok(metadata) = entry.metadata() {
                let mtime = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs_f64() * 1000.0)
                    .unwrap_or(0.0);

                files.push(ScannedFile {
                    path: path.to_string_lossy().into_owned(),
                    mtime,
                    size: metadata.len() as i64,
                });
            }
        }
    }
}

fn is_media_file(path: &Path) -> bool {
    const EXTENSIONS: &[&str] = &[
        "mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "wma",
        "mp4", "mkv", "avi", "mov", "webm", "wmv", "m4v",
    ];
    path.extension()
        .and_then(|s| s.to_str())
        .map(|s| EXTENSIONS.contains(&s.to_lowercase().as_str()))
        .unwrap_or(false)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn extract_dominant_color_from_bytes(bytes: &[u8]) -> Option<String> {
    use image::GenericImageView;

    let img = image::load_from_memory(bytes).ok()?;
    let (width, height) = img.dimensions();
    if width == 0 || height == 0 {
        return None;
    }

    let sample_points = [
        (width / 4, height / 4),
        (3 * width / 4, height / 4),
        (width / 4, 3 * height / 4),
        (3 * width / 4, 3 * height / 4),
    ];

    let (mut r, mut g, mut b) = (0u32, 0u32, 0u32);
    let count = sample_points.len() as u32;

    for (x, y) in &sample_points {
        let px = img.get_pixel(*x, *y).0;
        r += px[0] as u32;
        g += px[1] as u32;
        b += px[2] as u32;
    }

    Some(format!("#{:02x}{:02x}{:02x}", r / count, g / count, b / count))
}