use napi_derive::napi;
use std::path::Path;
use std::fs::File;
use lofty::prelude::*;
use lofty::file::AudioFile;
use lofty::probe::Probe;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use stratum_dsp::{analyze_audio as stratum_analyze, AnalysisConfig};
use rayon::prelude::*;

// ─────────────────────────────────────────────────────────────────────────────
// Structs exposed to Node
// ─────────────────────────────────────────────────────────────────────────────

#[napi(object)]
pub struct AudioAnalysis {
    pub bpm: f64,
    pub key: String,
    pub camelot_key: String,
    pub energy: f64,
    pub loudness: f64,
}

#[napi(object)]
pub struct ReplayGainResult {
    pub track_gain: f64,
    pub track_peak: f64,
}

#[napi(object)]
pub struct SubtitleTrack {
    pub index: u32,
    pub codec_name: String,
    pub language: Option<String>,
    pub title: Option<String>,
}

#[napi(object)]
pub struct TagInput {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
}

#[napi(object)]
pub struct HardwareCodecSupport {
    pub h264: bool,
    pub hevc: bool,
    pub av1: bool,
    pub vp9: bool,
}

#[napi(object)]
pub struct TrackMetadata {
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

    pub duration: f64,
    pub sample_rate: Option<i32>,
    pub bit_rate: Option<i64>,
    pub channels: Option<i32>,
    pub codec_name: Option<String>,
    pub file_type: String,

    pub width: Option<i32>,
    pub height: Option<i32>,
    pub frame_rate: Option<f64>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,

    pub cover_art_bytes: Option<Vec<u8>>,
    pub dominant_color: Option<String>,

    pub replaygain_track_gain: Option<f64>,
    pub replaygain_album_gain: Option<f64>,
    pub replaygain_track_peak: Option<f64>,
    pub replaygain_album_peak: Option<f64>,
}

#[napi(object)]
pub struct FingerprintResult {
    pub fingerprint: String,
    pub duration: f64,
}

#[napi(object)]
pub struct ScannedFile {
    pub path: String,
    pub mtime: f64,
    pub size: i64,
}

// ─────────────────────────────────────────────────────────────────────────────
// extractMetadata (using Lofty)
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn extract_metadata(path: String) -> Result<TrackMetadata, napi::Error> {
    let path_buf = Path::new(&path);
    let tagged_file = Probe::open(path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?
        .read()
        .map_err(|e| napi::Error::from_reason(format!("Failed to read metadata: {}", e)))?;

    let properties = tagged_file.properties();
    let duration = properties.duration().as_secs_f64();
    let bit_rate = properties.audio_bitrate().map(|br| br as i64);
    let sample_rate = properties.sample_rate().map(|sr| sr as i32);
    let channels = properties.channels().map(|c| c as i32);

    let mut title = None;
    let mut artist = None;
    let mut album_artist = None;
    let mut album = None;
    let mut genre = None;
    let mut year = None;
    let mut track_number = None;
    let mut disc_number = None;
    let mut composer = None;
    let lyricist = None;
    let mut comment = None;
    let mut copyright = None;
    let mut encoder = None;
    let mut lyrics = None;
    let synced_lyrics = None;

    if let Some(tag) = tagged_file.primary_tag() {
        title = tag.title().map(|s| s.into_owned());
        artist = tag.artist().map(|s| s.into_owned());
        album = tag.album().map(|s| s.into_owned());
        genre = tag.genre().map(|s| s.into_owned());
        year = tag.year().map(|y| y as i32);
        track_number = tag.track().map(|t| t as i32);
        disc_number = tag.disk().map(|d| d as i32);

        // Access other tags if available
        comment = tag.get_string(&lofty::tag::ItemKey::Comment).map(|s| s.to_string());
        composer = tag.get_string(&lofty::tag::ItemKey::Composer).map(|s| s.to_string());
        copyright = tag.get_string(&lofty::tag::ItemKey::CopyrightMessage).map(|s| s.to_string());
        encoder = tag.get_string(&lofty::tag::ItemKey::EncoderSoftware).map(|s| s.to_string());
        lyrics = tag.get_string(&lofty::tag::ItemKey::Lyrics).map(|s| s.to_string());
    }

    // Try to find album artist in any tag
    for tag in tagged_file.tags() {
        if album_artist.is_none() {
            album_artist = tag.get_string(&lofty::tag::ItemKey::AlbumArtist).map(|s| s.to_string());
        }
    }

    let mut cover_art_bytes = None;
    let mut dominant_color = None;

    if let Some(tag) = tagged_file.primary_tag() {
        if let Some(picture) = tag.pictures().first() {
            let bytes = picture.data().to_vec();
            dominant_color = extract_dominant_color_from_bytes(&bytes);
            cover_art_bytes = Some(bytes);
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
        codec_name: None, // Lofty doesn't easily give a string codec name like ffmpeg
        file_type: "audio".to_string(), // Defaulting to audio for lofty-supported files
        width: None,
        height: None,
        frame_rate: None,
        video_codec: None,
        audio_codec: None,
        cover_art_bytes,
        dominant_color,
        replaygain_track_gain: None,
        replaygain_album_gain: None,
        replaygain_track_peak: None,
        replaygain_album_peak: None,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Decoding helper (using Symphonia)
// ─────────────────────────────────────────────────────────────────────────────

fn decode_to_f32(path: &str, max_samples: Option<usize>) -> Result<(Vec<f32>, u32), napi::Error> {
    let src = File::open(path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?;
    let mss = MediaSourceStream::new(Box::new(src), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = Path::new(path).extension().and_then(|s| s.to_str()) {
        hint.with_extension(ext);
    }

    let meta_opts: MetadataOptions = Default::default();
    let fmt_opts: FormatOptions = Default::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &fmt_opts, &meta_opts)
        .map_err(|e| napi::Error::from_reason(format!("Unsupported format: {}", e)))?;

    let mut format = probed.format;
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL)
        .ok_or_else(|| napi::Error::from_reason("No supported track found"))?;

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| napi::Error::from_reason(format!("Failed to create decoder: {}", e)))?;

    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    let mut samples_f32 = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(SymphoniaError::IoError(_)) => break,
            Err(e) => return Err(napi::Error::from_reason(format!("Decoding error: {}", e))),
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let spec = *decoded.spec();
                let mut sample_buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
                sample_buf.copy_interleaved_ref(decoded);

                // Mix to mono
                let channels = spec.channels.count();
                let frames = sample_buf.samples().len() / channels;
                for i in 0..frames {
                    let mut sum = 0.0;
                    for c in 0..channels {
                        sum += sample_buf.samples()[i * channels + c];
                    }
                    samples_f32.push(sum / channels as f32);
                }
            }
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(e) => return Err(napi::Error::from_reason(format!("Decoding error: {}", e))),
        }

        if let Some(max) = max_samples {
            if samples_f32.len() >= max {
                break;
            }
        }
    }

    Ok((samples_f32, sample_rate))
}

// ─────────────────────────────────────────────────────────────────────────────
// analyzeAudio
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn analyze_audio(path: String) -> Result<AudioAnalysis, napi::Error> {
    let (samples_f32, sample_rate) = decode_to_f32(&path, Some(10_000_000))?;

    if samples_f32.is_empty() {
        return Err(napi::Error::from_reason("No audio samples decoded"));
    }

    let sum_sq: f64 = samples_f32.iter().map(|&s| (s as f64).powi(2)).sum();
    let rms = (sum_sq / samples_f32.len() as f64).sqrt();
    let loudness = if rms > 0.0 { 20.0 * rms.log10() } else { -96.0 };

    let result = stratum_analyze(&samples_f32, sample_rate, AnalysisConfig::default())
        .map_err(|e| napi::Error::from_reason(format!("Analysis error: {:?}", e)))?;

    Ok(AudioAnalysis {
        bpm: result.bpm as f64,
        key: result.key.name(),
        camelot_key: result.key.numerical(),
        energy: result.key_clarity as f64,
        loudness,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// generateWaveform
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn generate_waveform(path: String) -> Result<Vec<f32>, napi::Error> {
    let (samples_f32, _) = decode_to_f32(&path, None)?;
    if samples_f32.is_empty() {
        return Ok(vec![0.0; 1000]);
    }

    let num_buckets = 1000;
    let bucket_size = (samples_f32.len() / num_buckets).max(1);
    let mut buckets = vec![0.0f32; num_buckets];

    for i in 0..num_buckets {
        let start = i * bucket_size;
        let end = ((i + 1) * bucket_size).min(samples_f32.len());
        if start >= samples_f32.len() { break; }

        let window = &samples_f32[start..end];
        let sum_sq: f32 = window.iter().map(|&s| s * s).sum();
        buckets[i] = (sum_sq / window.len() as f32).sqrt();
    }

    let max_peak = buckets.iter().cloned().fold(0.0f32, f32::max);
    if max_peak > 0.0 {
        for peak in buckets.iter_mut() {
            *peak /= max_peak;
        }
    }

    Ok(buckets)
}

// ─────────────────────────────────────────────────────────────────────────────
// generateWaveformFingerprint
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn generate_waveform_fingerprint(path: String) -> Result<String, napi::Error> {
    let (samples_f32, _) = decode_to_f32(&path, Some(480_000))?;
    if samples_f32.is_empty() {
        return Err(napi::Error::from_reason("No audio samples decoded"));
    }

    let mut fingerprint = String::with_capacity(64);
    let window_size = (samples_f32.len() / 32).max(1);

    for i in 0..32 {
        let start = i * window_size;
        let end = if i == 31 { samples_f32.len() } else { (i + 1) * window_size };
        let window = &samples_f32[start..end];

        let sum_sq: f32 = window.iter().map(|&s| s * s).sum();
        let rms = (sum_sq / window.len() as f32).sqrt();
        let normalized = (rms * 255.0).min(255.0) as u8;
        fingerprint.push_str(&format!("{:02x}", normalized));
    }

    Ok(fingerprint)
}

// ─────────────────────────────────────────────────────────────────────────────
// generateThumbnail (Stubbed as pure-Rust video decoding is complex)
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn generate_thumbnail(
    _path: String,
    _time_seconds: f64,
    _output_path: String,
) -> Result<(), napi::Error> {
    // For standalone robust build without ffmpeg, we stub this or use cover art if it was a video container
    // that lofty can read (some support it).
    // In a real scenario, we might use a crate like `image` if we only wanted to resize an existing image.
    // For now, return a placeholder error that the server can handle.
    Err(napi::Error::from_reason("Thumbnail generation requires FFmpeg which is disabled for portability."))
}

// ─────────────────────────────────────────────────────────────────────────────
// getSubtitleTracks (Stub)
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn get_subtitle_tracks(_path: String) -> Result<Vec<SubtitleTrack>, napi::Error> {
    Ok(Vec::new())
}

// ─────────────────────────────────────────────────────────────────────────────
// extractSubtitleStream (Stub)
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn extract_subtitle_stream(_path: String, _stream_index: u32) -> Result<String, napi::Error> {
    Err(napi::Error::from_reason("Subtitle extraction not available in standalone mode."))
}

// ─────────────────────────────────────────────────────────────────────────────
// writeTags
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn write_tags(path: String, tags: TagInput) -> Result<(), napi::Error> {
    let path_buf = Path::new(&path);
    let mut tagged_file = Probe::open(path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?
        .read()
        .map_err(|e| napi::Error::from_reason(format!("Failed to read metadata: {}", e)))?;

    let tag = tagged_file.primary_tag_mut().ok_or_else(|| napi::Error::from_reason("No primary tag found to write to"))?;

    if let Some(t) = tags.title { tag.set_title(t); }
    if let Some(a) = tags.artist { tag.set_artist(a); }
    if let Some(a) = tags.album { tag.set_album(a); }
    if let Some(g) = tags.genre { tag.set_genre(g); }
    if let Some(y) = tags.year { tag.set_year(y as u32); }
    if let Some(t) = tags.track_number { tag.set_track(t as u32); }
    if let Some(d) = tags.disc_number { tag.set_disk(d as u32); }

    tagged_file.save_to_path(path_buf, lofty::config::WriteOptions::default())
        .map_err(|e| napi::Error::from_reason(format!("Failed to save tags: {}", e)))?;

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// probeHardwareCodecs
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn probe_hardware_codecs() -> Result<HardwareCodecSupport, napi::Error> {
    Ok(HardwareCodecSupport {
        h264: false,
        hevc: false,
        av1: false,
        vp9: false,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// generateFingerprint (Chromaprint / AcoustID) - Custom implementation or stub
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn generate_fingerprint(path: String) -> Result<FingerprintResult, napi::Error> {
    // Since we don't have chromaprint C library, we use our waveform fingerprint as a fallback
    // or just return a dummy if the exact chromaprint algorithm is required.
    // For now, we'll use the waveform fingerprint logic but return it in the expected struct.
    let fp = generate_waveform_fingerprint(path.clone())?;

    // We need duration too
    let tagged_file = Probe::open(Path::new(&path))
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?
        .read()
        .map_err(|e| napi::Error::from_reason(format!("Failed to read metadata: {}", e)))?;
    let duration = tagged_file.properties().duration().as_secs_f64();

    Ok(FingerprintResult {
        fingerprint: fp,
        duration,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// scanFolders
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn scan_folders(folders: Vec<String>) -> Vec<ScannedFile> {
    folders
        .into_par_iter()
        .flat_map(|folder| {
            let mut files = Vec::new();
            let p = Path::new(&folder);
            if p.is_dir() {
                walk_dir(p, &mut files);
            }
            files
        })
        .collect()
}

fn walk_dir(dir: &Path, files: &mut Vec<ScannedFile>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_dir(&path, files);
        } else if is_media_file(&path) {
            if let Ok(metadata) = entry.metadata() {
                let mtime = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as f64)
                    .unwrap_or(0.0);

                files.push(ScannedFile {
                    path: path.to_string_lossy().into_owned(),
                    mtime,
                    size: metadata.len() as i64,
                });
            }
        }
    }
}

fn is_media_file(path: &Path) -> bool {
    const EXTENSIONS: &[&str] = &[
        "mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "wma",
        "mp4", "mkv", "avi", "mov", "webm", "wmv", "m4v",
    ];
    path.extension()
        .and_then(|s| s.to_str())
        .map(|s| EXTENSIONS.contains(&s.to_lowercase().as_str()))
        .unwrap_or(false)
}

// ─────────────────────────────────────────────────────────────────────────────
// computeReplayGain
// ─────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn compute_replay_gain(paths: Vec<String>) -> Result<Vec<ReplayGainResult>, napi::Error> {
    paths
        .iter()
        .map(|p| {
            let analysis = analyze_audio(p.clone())?;
            let track_gain = -14.0 - analysis.loudness;
            Ok(ReplayGainResult {
                track_gain,
                track_peak: 0.9,
            })
        })
        .collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn extract_dominant_color_from_bytes(bytes: &[u8]) -> Option<String> {
    use image::GenericImageView;

    let img = image::load_from_memory(bytes).ok()?;
    let (width, height) = img.dimensions();
    if width == 0 || height == 0 {
        return None;
    }

    let sample_points = [
        (width / 4, height / 4),
        (3 * width / 4, height / 4),
        (width / 4, 3 * height / 4),
        (3 * width / 4, 3 * height / 4),
    ];

    let (mut r, mut g, mut b) = (0u32, 0u32, 0u32);
    let count = sample_points.len() as u32;

    for (x, y) in &sample_points {
        let px = img.get_pixel(*x, *y).0;
        r += px[0] as u32;
        g += px[1] as u32;
        b += px[2] as u32;
    }

    Some(format!("#{:02x}{:02x}{:02x}", r / count, g / count, b / count))
}
