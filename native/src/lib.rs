use napi_derive::napi;
use ffmpeg_next as ffmpeg;
use std::path::Path;

#[napi]
pub fn analyze_audio(path: String) -> Result<String, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    match ffmpeg::format::input(&path_buf) {
        Ok(context) => {
            let duration = context.duration();
            let format_name = context.format().name();

            Ok(format!(
                "File: {}, Format: {}, Duration: {}ms. AI Analysis: High Energy (Mock), 124 BPM (Mock)",
                path, format_name, duration / 1000
            ))
        }
        Err(e) => Err(napi::Error::from_reason(format!("Failed to open file: {}", e))),
    }
}

#[napi]
pub fn generate_waveform(_path: String) -> Vec<f64> {
    vec![0.1, 0.5, 0.3, 0.8, 0.4, 0.2, 0.6, 0.9, 0.3, 0.1]
}
