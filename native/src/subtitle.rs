use napi_derive::napi;
use ffmpeg_next as ffmpeg;
use std::path::Path;

#[napi(object)]
pub struct SubtitleTrack {
    pub index: u32,
    pub codec_name: String,
    pub language: Option<String>,
    pub title: Option<String>,
}

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
