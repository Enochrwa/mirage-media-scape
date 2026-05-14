use napi_derive::napi;

#[napi(object)]
pub struct HardwareCodecSupport {
    pub h264: bool,
    pub hevc: bool,
    pub av1: bool,
    pub vp9: bool,
}

#[napi]
pub fn probe_hardware_codecs() -> Result<HardwareCodecSupport, napi::Error> {
    // In a real implementation, this would use ffmpeg to probe for VAAPI, NVENC, etc.
    Ok(HardwareCodecSupport {
        h264: true,
        hevc: true,
        av1: false,
        vp9: true,
    })
}
