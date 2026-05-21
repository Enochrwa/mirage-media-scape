use napi_derive::napi;
use ffmpeg_next as ffmpeg;

#[napi(object)]
pub struct HardwareCodecSupport {
    pub h264: bool,
    pub hevc: bool,
    pub av1: bool,
    pub vp9: bool,
}

/// Probe for hardware-accelerated decoder availability by checking known
/// platform-specific codec names via `avcodec_find_decoder_by_name`.
///
/// Hardware decoder naming conventions:
///   macOS  : h264_videotoolbox, hevc_videotoolbox
///   Windows: h264_d3d11va, hevc_d3d11va, h264_dxva2, av1_d3d11va
///   Linux  : h264_vaapi, hevc_vaapi, av1_vaapi, vp9_vaapi,
///             h264_nvdec, hevc_nvdec, av1_nvdec, vp9_nvdec,
///             h264_vdpau, hevc_vdpau
///
/// `find_all()` does not exist in ffmpeg-next; we probe by name instead.
#[napi]
pub fn probe_hardware_codecs() -> Result<HardwareCodecSupport, napi::Error> {
    ffmpeg::init()
        .map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    // Each tuple: (codec_name, affects_h264, affects_hevc, affects_av1, affects_vp9)
    let hw_decoders: &[(&str, bool, bool, bool, bool)] = &[
        // macOS – VideoToolbox
        ("h264_videotoolbox",  true,  false, false, false),
        ("hevc_videotoolbox",  false, true,  false, false),
        // Windows – D3D11VA / DXVA2
        ("h264_d3d11va",       true,  false, false, false),
        ("h264_d3d11va2",      true,  false, false, false),
        ("h264_dxva2",         true,  false, false, false),
        ("hevc_d3d11va",       false, true,  false, false),
        ("hevc_d3d11va2",      false, true,  false, false),
        ("av1_d3d11va",        false, false, true,  false),
        ("av1_d3d11va2",       false, false, true,  false),
        ("vp9_d3d11va",        false, false, false, true),
        // Linux – VAAPI
        ("h264_vaapi",         true,  false, false, false),
        ("hevc_vaapi",         false, true,  false, false),
        ("av1_vaapi",          false, false, true,  false),
        ("vp9_vaapi",          false, false, false, true),
        // Linux – NVDEC (NVIDIA)
        ("h264_nvdec",         true,  false, false, false),
        ("hevc_nvdec",         false, true,  false, false),
        ("av1_nvdec",          false, false, true,  false),
        ("vp9_nvdec",          false, false, false, true),
        // Linux – VDPAU
        ("h264_vdpau",         true,  false, false, false),
        ("hevc_vdpau",         false, true,  false, false),
    ];

    let mut support = HardwareCodecSupport {
        h264: false,
        hevc: false,
        av1: false,
        vp9: false,
    };

    for &(name, h264, hevc, av1, vp9) in hw_decoders {
        if ffmpeg::decoder::find_by_name(name).is_some() {
            if h264 { support.h264 = true; }
            if hevc { support.hevc = true; }
            if av1  { support.av1  = true; }
            if vp9  { support.vp9  = true; }
        }
    }

    Ok(support)
}

#[napi]
pub fn initialize_hardware_decode() -> Result<HardwareCodecSupport, napi::Error> {
    ffmpeg::init()
        .map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let mut support = HardwareCodecSupport {
        h264: false,
        hevc: false,
        av1: false,
        vp9: false,
    };

    // Windows: DXVA2 / D3D11VA
    #[cfg(target_os = "windows")]
    {
        if ffmpeg::decoder::find_by_name("h264_d3d11va").is_some() || ffmpeg::decoder::find_by_name("h264_dxva2").is_some() {
            support.h264 = true;
        }
        if ffmpeg::decoder::find_by_name("hevc_d3d11va").is_some() {
            support.hevc = true;
        }
        if ffmpeg::decoder::find_by_name("av1_d3d11va").is_some() {
            support.av1 = true;
        }
        if ffmpeg::decoder::find_by_name("vp9_d3d11va").is_some() {
            support.vp9 = true;
        }
    }

    // macOS: VideoToolbox
    #[cfg(target_os = "macos")]
    {
        if ffmpeg::decoder::find_by_name("h264_videotoolbox").is_some() {
            support.h264 = true;
        }
        if ffmpeg::decoder::find_by_name("hevc_videotoolbox").is_some() {
            support.hevc = true;
        }
    }

    // Linux: VAAPI / NVDEC
    #[cfg(target_os = "linux")]
    {
        if ffmpeg::decoder::find_by_name("h264_vaapi").is_some() || ffmpeg::decoder::find_by_name("h264_nvdec").is_some() {
            support.h264 = true;
        }
        if ffmpeg::decoder::find_by_name("hevc_vaapi").is_some() || ffmpeg::decoder::find_by_name("hevc_nvdec").is_some() {
            support.hevc = true;
        }
        if ffmpeg::decoder::find_by_name("av1_vaapi").is_some() || ffmpeg::decoder::find_by_name("av1_nvdec").is_some() {
            support.av1 = true;
        }
        if ffmpeg::decoder::find_by_name("vp9_vaapi").is_some() || ffmpeg::decoder::find_by_name("vp9_nvdec").is_some() {
            support.vp9 = true;
        }
    }

    Ok(support)
}