use napi_derive::napi;
use ffmpeg_next as ffmpeg;

/// Plain-Rust hardware codec support result — no napi types involved.
/// This is what non-Node consumers (e.g. the Tauri desktop shell) should use.
#[derive(Debug, Clone, Copy, Default)]
pub struct HardwareCodecSupportPlain {
    pub h264: bool,
    pub hevc: bool,
    pub av1: bool,
    pub vp9: bool,
}

#[napi(object)]
pub struct HardwareCodecSupport {
    pub h264: bool,
    pub hevc: bool,
    pub av1: bool,
    pub vp9: bool,
}

impl From<HardwareCodecSupportPlain> for HardwareCodecSupport {
    fn from(p: HardwareCodecSupportPlain) -> Self {
        HardwareCodecSupport {
            h264: p.h264,
            hevc: p.hevc,
            av1: p.av1,
            vp9: p.vp9,
        }
    }
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
///
/// This is the napi-free core implementation. Use this directly from plain Rust
/// consumers (e.g. the Tauri desktop shell) — calling into napi-derived functions
/// or napi::Error from a non-Node host process is unsupported, since napi-rs
/// requires symbols to resolve against a live Node-API host.
pub fn probe_hardware_codecs_plain() -> Result<HardwareCodecSupportPlain, String> {
    ffmpeg::init().map_err(|e| format!("FFmpeg init error: {}", e))?;

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

    let mut support = HardwareCodecSupportPlain::default();

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

/// Node/napi-facing wrapper. Only call this from the compiled .node addon —
/// it converts napi::Error, which requires a live Node-API host to construct
/// and propagate correctly.
#[napi]
pub fn probe_hardware_codecs() -> Result<HardwareCodecSupport, napi::Error> {
    probe_hardware_codecs_plain()
        .map(HardwareCodecSupport::from)
        .map_err(napi::Error::from_reason)
}