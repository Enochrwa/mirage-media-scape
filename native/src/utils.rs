use std::path::Path;
use crate::indexing::ScannedFile;

pub fn extract_dominant_color_from_bytes(bytes: &[u8]) -> Option<String> {
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

pub fn walk_dir<F>(dir: &Path, on_file: &mut F)
where
    F: FnMut(ScannedFile),
{
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_dir(&path, on_file);
        } else if is_media_file(&path) {
            if let Ok(metadata) = entry.metadata() {
                // Return mtime as milliseconds (f64) for consistent JS Date compatibility
                let mtime = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as f64)
                    .unwrap_or(0.0);

                on_file(ScannedFile {
                    path: path.to_string_lossy().into_owned(),
                    mtime,
                    size: metadata.len() as i64,
                });
            }
        }
    }
}

pub fn is_media_file(path: &Path) -> bool {
    const EXTENSIONS: &[&str] = &[
        "mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "wma",
        "mp4", "mkv", "avi", "mov", "webm", "wmv", "m4v",
    ];
    path.extension()
        .and_then(|s| s.to_str())
        .map(|s| EXTENSIONS.contains(&s.to_lowercase().as_str()))
        .unwrap_or(false)
}
