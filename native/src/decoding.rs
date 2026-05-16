use napi_derive::napi;
use ffmpeg_next as ffmpeg;

#[napi(object)]
pub struct HardwareCodecSupport {
    pub h264: bool,
    pub hevc: bool,
    pub av1: bool,
    pub vp9: bool,
}

#[napi]
pub fn probe_hardware_codecs() -> Result<HardwareCodecSupport, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let mut support = HardwareCodecSupport {
        h264: false,
        hevc: false,
        av1: false,
        vp9: false,
    };

    // Check for hardware decoders by name
    for decoder in ffmpeg::decoder::find_all() {
        let name = decoder.name();
        // macOS: videotoolbox
        // Windows: d3d11va, dxva2
        // Linux: vaapi, nvdec, vdpau
        if name.contains("videotoolbox") || name.contains("d3d11va") || name.contains("dxva2") || name.contains("vaapi") || name.contains("nvdec") {
            if name.contains("h264") { support.h264 = true; }
            if name.contains("hevc") || name.contains("h265") { support.hevc = true; }
            if name.contains("av1") { support.av1 = true; }
            if name.contains("vp9") { support.vp9 = true; }
        }
    }

    // Fallback/Simulated support if no explicit HW decoders found in this environment
    if !support.h264 && !support.hevc && !support.av1 && !support.vp9 {
         // In CI/Sandbox we might not see them, but we should return what we probed
    }

    Ok(support)
}
