use serde::Serialize;
use zovyra_native::decoding::probe_hardware_codecs;
use zovyra_native::TrackMetadata;

#[derive(Serialize)]
pub struct HardwareCodecs {
    pub h264: bool,
    pub hevc: bool,
    pub av1: bool,
    pub vp9: bool,
}

#[derive(Serialize)]
pub struct PlatformProbeResult {
    pub hardware_codecs: HardwareCodecs,
    pub can_hdr: bool,
    pub os_type: String, // "macos" | "windows" | "linux"
}

/// Called once at startup by the frontend via invoke('probe_platform').
#[tauri::command]
pub async fn probe_platform() -> Result<PlatformProbeResult, String> {
    let codecs = probe_hardware_codecs()
        .map_err(|e| e.to_string())?;

    let os_type = if cfg!(target_os = "macos") { "macos" }
                  else if cfg!(target_os = "windows") { "windows" }
                  else { "linux" };

    let can_hdr = cfg!(target_os = "macos");

    Ok(PlatformProbeResult {
        hardware_codecs: HardwareCodecs {
            h264: codecs.h264,
            hevc: codecs.hevc,
            av1: codecs.av1,
            vp9: codecs.vp9,
        },
        can_hdr,
        os_type: os_type.to_string(),
    })
}

#[tauri::command]
pub async fn update_media_metadata(title: String, artist: String, album: String) -> Result<(), String> {
    // In a real implementation, this would call native MPRIS/MediaRemote APIs via Rust
    println!("Updating media metadata: {} - {} ({})", artist, title, album);
    Ok(())
}
