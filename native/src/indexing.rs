use napi_derive::napi;
use rayon::prelude::*;
use std::path::Path;
use crate::utils::{walk_dir};

#[napi(object)]
pub struct ScannedFile {
    pub path: String,
    /// Milliseconds since Unix epoch (as f64 to avoid i64 overflow on JS side)
    pub mtime: f64,
    pub size: i64,
}

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
