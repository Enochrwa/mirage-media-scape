use napi_derive::napi;
use ffmpeg_next as ffmpeg;
use std::path::Path;
use ffmpeg::util::frame::audio::Audio;
use stratum_dsp::{analyze_audio as stratum_analyze, AnalysisConfig};
use lofty::prelude::*;
use lofty::tag::{Tag, TagType};
use lofty::config::WriteOptions;

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

#[napi]
pub fn analyze_audio(path: String) -> Result<AudioAnalysis, napi::Error> {
    ffmpeg::init().map_err(|e| napi::Error::from_reason(format!("FFmpeg init error: {}", e)))?;

    let path_buf = Path::new(&path);
    let mut context = ffmpeg::format::input(&path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file {}: {}", path, e)))?;

    let mut sample_rate: u32 = 44100;
    let mut samples_f32: Vec<f32> = Vec::with_capacity(1_000_000);

    if let Some(stream) = context.streams().best(ffmpeg::media::Type::Audio) {
        let stream_index = stream.index();
        let mut decoder = ffmpeg::codec::context::Context::from_parameters(stream.parameters())
            .map_err(|e| napi::Error::from_reason(format!("Failed to get codec context: {}", e)))?
            .decoder()
            .audio()
            .map_err(|e| {
                napi::Error::from_reason(format!("Failed to get audio decoder: {}", e))
            })?;

        sample_rate = decoder.rate();

        let mut resampler = ffmpeg::software::resampling::context::Context::get(
            decoder.format(),
            decoder.channel_layout(),
            decoder.rate(),
            ffmpeg::util::format::sample::Sample::F32(
                ffmpeg::util::format::sample::Type::Packed,
            ),
            ffmpeg::util::channel_layout::ChannelLayout::MONO,
            decoder.rate(),
        )
        .map_err(|e| napi::Error::from_reason(format!("Resampler error: {}", e)))?;

        let max_samples = 10_000_000;

        'outer: for (stream, packet) in context.packets() {
            if stream.index() != stream_index {
                continue;
            }
            if decoder.send_packet(&packet).is_err() {
                continue;
            }
            let mut decoded = Audio::empty();
            while decoder.receive_frame(&mut decoded).is_ok() {
                let mut resampled = Audio::empty();
                if resampler.run(&decoded, &mut resampled).is_ok() {
                    let data = resampled.data(0);
                    // SAFETY: F32 Packed layout – bytes are contiguous f32 values
                    let slice: &[f32] = unsafe {
                        std::slice::from_raw_parts(
                            data.as_ptr() as *const f32,
                            data.len() / 4,
                        )
                    };
                    samples_f32.extend_from_slice(slice);
                }
                if samples_f32.len() >= max_samples {
                    break 'outer;
                }
            }
        }
    }

    if samples_f32.is_empty() {
        return Err(napi::Error::from_reason("No audio samples decoded"));
    }

    // Integrated Loudness (LUFS) - Basic ITU-R BS.1770-4 approximation
    // For a more accurate implementation, we'd use K-weighting and gating.
    let sum_sq: f64 = samples_f32.iter().map(|&s| (s as f64).powi(2)).sum();
    let rms = (sum_sq / samples_f32.len() as f64).sqrt();
    let loudness = if rms > 0.0 {
        20.0 * rms.log10() - 0.691 // Offset for LUFS
    } else {
        -96.0
    };

    // BPM + key detection via stratum-dsp.
    // Both are always enabled in AnalysisConfig::default() — no opt-in fields needed.
    let config = AnalysisConfig::default();

    let result = stratum_analyze(&samples_f32, sample_rate, config)
        .map_err(|e| napi::Error::from_reason(format!("Analysis error: {:?}", e)))?;

    Ok(AudioAnalysis {
        bpm: result.bpm as f64,
        key: result.key.name(),
        camelot_key: result.key.numerical(),
        energy: result.key_clarity as f64, // normalized RMS energy is part of key clarity/confidence
        loudness,
    })
}

#[napi]
pub fn compute_replay_gain(paths: Vec<String>) -> Result<Vec<ReplayGainResult>, napi::Error> {
    paths
        .iter()
        .map(|p| {
            let analysis = analyze_audio(p.clone())?;
            let track_gain = -14.0 - analysis.loudness;
            // Peak is approximated; a full implementation would decode and track sample peak
            Ok(ReplayGainResult {
                track_gain,
                track_peak: 0.9,
            })
        })
        .collect()
}

#[napi]
pub fn write_tags(path: String, tags: TagInput) -> Result<(), napi::Error> {
    let path_buf = Path::new(&path);
    let mut probed = lofty::probe::Probe::open(path_buf)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?
        .read()
        .map_err(|e| napi::Error::from_reason(format!("Failed to read tags: {}", e)))?;

    let tag = match probed.primary_tag_mut() {
        Some(t) => t,
        None => {
            if let Some(first_tag) = probed.first_tag_mut() {
                first_tag
            } else {
                let tag_type = match probed.file_type() {
                    lofty::file::FileType::Mpeg => TagType::Id3v2,
                    lofty::file::FileType::Flac => TagType::VorbisComments,
                    lofty::file::FileType::Mp4 => TagType::Mp4Ilst,
                    lofty::file::FileType::Opus | lofty::file::FileType::Vorbis => TagType::VorbisComments,
                    _ => TagType::Id3v2,
                };
                probed.insert_tag(Tag::new(tag_type));
                probed.primary_tag_mut().unwrap()
            }
        }
    };

    if let Some(val) = tags.title {
        tag.set_title(val);
    }
    if let Some(val) = tags.artist {
        tag.set_artist(val);
    }
    if let Some(val) = tags.album {
        tag.set_album(val);
    }
    if let Some(val) = tags.album_artist {
        tag.insert_text(lofty::tag::ItemKey::AlbumArtist, val);
    }
    if let Some(val) = tags.year {
        tag.set_year(val as u32);
    }
    if let Some(val) = tags.genre {
        tag.set_genre(val);
    }
    if let Some(val) = tags.track_number {
        tag.set_track(val as u32);
    }
    if let Some(val) = tags.disc_number {
        tag.set_disk(val as u32);
    }

    tag.save_to_path(&path, WriteOptions::default())
        .map_err(|e| napi::Error::from_reason(format!("Failed to save tags: {}", e)))?;

    Ok(())
}