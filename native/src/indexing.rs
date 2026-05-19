use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use std::path::Path;
use crate::utils::{walk_dir};

#[napi(object)]
#[derive(Clone)]
pub struct ScannedFile {
    pub path: String,
    /// Milliseconds since Unix epoch (as f64 to avoid i64 overflow on JS side)
    pub mtime: f64,
    pub size: i64,
}

#[napi]
pub fn scan_folders(folders: Vec<String>, callback: ThreadsafeFunction<Option<Vec<ScannedFile>>>) {
    let folders = folders.clone();

    std::thread::spawn(move || {
        let mut batch = Vec::with_capacity(200);

        for folder in folders {
            let p = Path::new(&folder);
            if p.is_dir() {
                walk_dir(p, &mut |file| {
                    batch.push(file);
                    if batch.len() >= 200 {
                        let to_send = batch.clone();
                        callback.call(
                            Ok(Some(to_send)),
                            ThreadsafeFunctionCallMode::Blocking,
                        );
                        batch.clear();
                    }
                });
            }
        }

        if !batch.is_empty() {
            callback.call(
                Ok(Some(batch)),
                ThreadsafeFunctionCallMode::Blocking,
            );
        }

        // Final completion signal
        callback.call(
            Ok(None),
            ThreadsafeFunctionCallMode::Blocking,
        );
    });
}
