use napi_derive::napi;
use ffmpeg_next as ffmpeg;
use std::path::Path;
use crate::utils::extract_dominant_color_from_bytes;

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
