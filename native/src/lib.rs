pub mod decoding;
pub mod dsp;
pub mod metadata;
pub mod transcoding;
pub mod indexing;
pub mod streaming;
pub mod visualization;
pub mod subtitle;
pub mod utils;

pub use metadata::{extract_metadata, TrackMetadata};
pub use transcoding::generate_thumbnail;
pub use subtitle::{get_subtitle_tracks, extract_subtitle_stream, SubtitleTrack};
pub use dsp::{write_tags, analyze_audio, compute_replay_gain, AudioAnalysis, ReplayGainResult, TagInput};
pub use decoding::{probe_hardware_codecs, HardwareCodecSupport};
pub use visualization::{generate_waveform, generate_waveform_fingerprint, generate_fingerprint, FingerprintResult};
pub use indexing::{scan_folders, scan_folders_batch, ScannedFile};
