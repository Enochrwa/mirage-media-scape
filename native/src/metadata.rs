use napi_derive::napi;
use ffmpeg_next as ffmpeg;
use std::path::Path;
use crate::utils::extract_dominant_color_from_bytes;

/// Full metadata struct – mirrors both `native/index.d.ts` and
/// `server/zovyra-native.d.ts` exactly.
#[napi(object)]
pub struct ChapterInfo {
    pub index: i32,
    pub title: Option<String>,
    pub start_time_ms: i64,
    pub end_time_ms: i64,
}

#[napi(object)]
pub struct AudioStreamInfo {
    pub index: i32,
    pub language: Option<String>,
    pub codec_name: Option<String>,
    pub channels: Option<i32>,
    pub sample_rate: Option<i32>,
}

#[napi(object)]
pub struct SubtitleStreamInfo {
    pub index: i32,
    pub language: Option<String>,
    pub codec_name: Option<String>,
}

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

    // ── gapless info ──────────────────────────────────────────────────────
    pub encoder_delay: Option<i32>,
    pub encoder_padding: Option<i32>,

    // ── chapters ──────────────────────────────────────────────────────────
    pub chapters: Vec<ChapterInfo>,

    pub audio_streams: Vec<AudioStreamInfo>,
    pub subtitle_streams: Vec<SubtitleStreamInfo>,
}

fn detect_codec_by_magic_bytes(path: &Path) -> Option<String> {
    use std::fs::File;
    use std::io::Read;

    let mut file = File::open(path).ok()?;
    let mut buffer = [0u8; 12];
    let n = file.read(&mut buffer).ok()?;
    if n < 4 {
        return None;
    }

    // Common magic bytes
    if &buffer[0..4] == b"fLaC" {
        return Some("flac".to_string());
    }
    if &buffer[0..4] == b"OggS" {
        return Some("ogg".to_string());
    }
    if &buffer[0..3] == b"ID3" || (buffer[0] == 0xFF && (buffer[1] & 0xE0) == 0xE0) {
        return Some("mp3".to_string());
    }
    if &buffer[0..4] == b"RIFF" && n >= 12 && &buffer[8..12] == b"WAVE" {
        return Some("wav".to_string());
    }
    if n >= 8 && &buffer[4..8] == b"ftyp" {
        return Some("m4a/mp4".to_string());
    }
    if &buffer[0..4] == b"\x1A\x45\xDF\xA3" {
        return Some("mkv/webm".to_string());
    }

    None
}

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
    let mut encoder_delay: Option<i32> = None;
    let mut encoder_padding: Option<i32> = None;

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
            "itunsmpb" => {
                // iTunSMPB format: " 00000000 00000840 000001D0 00000000002A3C20 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000"
                // Parts: [preamble, delay, padding, samples, ...]
                let parts: Vec<&str> = value.split_whitespace().collect();
                if parts.len() >= 3 {
                    encoder_delay = i32::from_str_radix(parts[1], 16).ok();
                    encoder_padding = i32::from_str_radix(parts[2], 16).ok();
                }
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
    let mut codec_name: Option<String> = detect_codec_by_magic_bytes(path_buf);
    let mut file_type = "audio".to_string();
    let mut attached_pic_stream_index: Option<usize> = None;
    let mut audio_streams = Vec::new();
    let mut subtitle_streams = Vec::new();

    for stream in context.streams() {
        let params = stream.parameters();
        match params.medium() {
            ffmpeg::media::Type::Audio => {
                let stream_codec_name = params.id().name().to_string();
                let mut stream_channels = None;
                let mut stream_sample_rate = None;

                if let Ok(codec_ctx) =
                    ffmpeg::codec::context::Context::from_parameters(params)
                {
                    if let Ok(audio) = codec_ctx.decoder().audio() {
                        stream_sample_rate = Some(audio.rate() as i32);
                        stream_channels = Some(audio.channels() as i32);
                    }
                }

                if sample_rate.is_none() {
                    audio_codec = Some(stream_codec_name.clone());
                    if codec_name.is_none() {
                        codec_name = Some(stream_codec_name.clone());
                    }
                    sample_rate = stream_sample_rate;
                    channels = stream_channels;
                }

                let mut language = None;
                for (key, value) in stream.metadata().iter() {
                    if key.to_lowercase() == "language" {
                        language = Some(value.to_string());
                        break;
                    }
                }

                audio_streams.push(AudioStreamInfo {
                    index: stream.index() as i32,
                    language,
                    codec_name: Some(stream_codec_name),
                    channels: stream_channels,
                    sample_rate: stream_sample_rate,
                });
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
            ffmpeg::media::Type::Subtitle => {
                let stream_codec_name = params.id().name().to_string();
                let mut language = None;
                for (key, value) in stream.metadata().iter() {
                    if key.to_lowercase() == "language" {
                        language = Some(value.to_string());
                        break;
                    }
                }
                subtitle_streams.push(SubtitleStreamInfo {
                    index: stream.index() as i32,
                    language,
                    codec_name: Some(stream_codec_name),
                });
            }
            _ => {}
        }
    }

    // ── chapters ──────────────────────────────────────────────────────────
    let mut chapters = Vec::new();
    for chapter in context.chapters() {
        let mut title = None;
        for (key, value) in chapter.metadata().iter() {
            if key.to_lowercase() == "title" {
                title = Some(value.to_string());
                break;
            }
        }

        let time_base = chapter.time_base();
        let start_ms = (chapter.start() as f64 * f64::from(time_base.0) / f64::from(time_base.1)
            * 1000.0) as i64;
        let end_ms = (chapter.end() as f64 * f64::from(time_base.0) / f64::from(time_base.1)
            * 1000.0) as i64;

        chapters.push(ChapterInfo {
            index: chapter.id() as i32,
            title,
            start_time_ms: start_ms,
            end_time_ms: end_ms,
        });
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
        encoder_delay,
        encoder_padding,
        chapters,
        audio_streams,
        subtitle_streams,
    })
}
