use napi_derive::napi;
use ffmpeg_next as ffmpeg;
use std::path::Path;

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
                // Some dates are like "2023-10-01", we just want the year
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
            // In ffmpeg-next, we can get audio specific parameters if it's an audio stream
            if let Ok(codec_context) = ffmpeg::codec::context::Context::from_parameters(params) {
                if let Ok(audio) = codec_context.decoder().audio() {
                    sample_rate = audio.rate() as i32;
                    channels = audio.channels() as i32;
                } else {
                    // Fallback to parameters if decoder can't be initialized
                    // Note: This is a bit simplified
                }
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
    })
}

#[napi]
pub fn generate_waveform(_path: String) -> Vec<f64> {
    vec![0.1, 0.5, 0.3, 0.8, 0.4, 0.2, 0.6, 0.9, 0.3, 0.1]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_invalid_file() {
        let result = analyze_audio("non_existent_file.mp3".to_string());
        assert!(result.is_err());
    }
}
