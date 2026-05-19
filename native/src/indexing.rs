use napi_derive::napi;
use std::path::Path;
use std::sync::mpsc;
use crate::utils::{walk_dir};

#[napi(object)]
pub struct ScannedFile {
    pub path: String,
    /// Milliseconds since Unix epoch (as f64 to avoid i64 overflow on JS side)
    pub mtime: f64,
    pub size: i64,
}

/// Scan folders and return results in batches to avoid loading all files into memory at once.
/// This is critical for low-RAM devices with large libraries.
#[napi]
pub fn scan_folders_batch(folders: Vec<String>, batch_size: Option<u32>) -> Vec<Vec<ScannedFile>> {
    let batch_size = batch_size.unwrap_or(200) as usize;
    let mut all_files: Vec<ScannedFile> = Vec::new();
    
    // Collect all files first (can't avoid this without async/channels)
    for folder in folders {
        let p = Path::new(&folder);
        if p.is_dir() {
            let mut folder_files = Vec::new();
            walk_dir(p, &mut folder_files);
            all_files.extend(folder_files);
        }
    }
    
    // Split into batches
    let batches: Vec<Vec<ScannedFile>> = all_files
        .chunks(batch_size)
        .map(|chunk| chunk.to_vec())
        .collect();
    
    batches
}

/// Legacy function - returns all files in one call. Use scan_folders_batch for low-RAM devices.
#[napi]
pub fn scan_folders(folders: Vec<String>) -> Vec<ScannedFile> {
    let mut all_files: Vec<ScannedFile> = Vec::new();
    
    for folder in folders {
        let p = Path::new(&folder);
        if p.is_dir() {
            walk_dir(p, &mut all_files);
        }
    }
    
    all_files
}
