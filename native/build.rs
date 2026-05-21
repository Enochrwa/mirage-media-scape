/// build.rs – Zovyra Native

use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    // Required by napi-rs
    napi_build::setup();

    // Configure FFmpeg to skip documentation (bundled build)
    // This prevents Perl/Texinfo errors while building FFmpeg from source
    env::set_var("FFMPEG_CONFIGURE_FLAGS", "--disable-doc --disable-podpages");

    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();

    match target_os.as_str() {
        "linux" => setup_linux_clang_args(),
        "macos" => setup_macos_clang_args(),
        _ => {}
    }
}

fn setup_linux_clang_args() {
    let triples = [
        "x86_64-linux-gnu",
        "aarch64-linux-gnu",
        "armv7l-linux-gnueabihf",
        "arm-linux-gnueabihf",
        "i686-linux-gnu",
        "riscv64-linux-gnu",
    ];

    let mut gcc_include: Option<PathBuf> = None;
    let mut arch_include: Option<PathBuf> = None;

    'outer: for triple in &triples {
        let base = PathBuf::from(format!("/usr/lib/gcc/{}", triple));

        if !base.exists() {
            continue;
        }

        if let Ok(entries) = fs::read_dir(&base) {
            let mut versions: Vec<u32> = entries
                .flatten()
                .filter_map(|e| {
                    e.file_name()
                        .to_str()
                        .and_then(|s| s.parse::<u32>().ok())
                })
                .collect();

            versions.sort_unstable();

            if let Some(&ver) = versions.last() {
                let include_dir = base.join(ver.to_string()).join("include");

                if include_dir.exists() {
                    gcc_include = Some(include_dir);

                    let arch_dir =
                        PathBuf::from(format!("/usr/include/{}", triple));

                    if arch_dir.exists() {
                        arch_include = Some(arch_dir);
                    }

                    break 'outer;
                }
            }
        }
    }

    let mut flags: Vec<String> = Vec::new();

    if let Some(p) = gcc_include {
        flags.push(format!("-I{}", p.display()));

        println!(
            "cargo:warning=bindgen: adding GCC include path {}",
            p.display()
        );
    }

    if let Some(p) = arch_include {
        flags.push(format!("-I{}", p.display()));
    }

    if !flags.is_empty() {
        if env::var("BINDGEN_EXTRA_CLANG_ARGS").is_err() {
            let joined = flags.join(" ");

            unsafe {
                env::set_var("BINDGEN_EXTRA_CLANG_ARGS", &joined);
            }

            println!(
                "cargo:warning=bindgen: BINDGEN_EXTRA_CLANG_ARGS={}",
                joined
            );
        }
    }
}

fn setup_macos_clang_args() {
    if env::var("BINDGEN_EXTRA_CLANG_ARGS").is_ok() {
        return;
    }

    let sdk_path = Command::new("xcrun")
        .args(["--sdk", "macosx", "--show-sdk-path"])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout).ok()
            } else {
                None
            }
        })
        .map(|s| s.trim().to_owned());

    match sdk_path {
        Some(path) if !path.is_empty() => {
            let flags = format!(
                "--sysroot={} -isysroot {}",
                path, path
            );

            unsafe {
                env::set_var("BINDGEN_EXTRA_CLANG_ARGS", &flags);
            }

            println!(
                "cargo:warning=bindgen: macOS sysroot set to {}",
                path
            );
        }

        _ => {
            println!(
                "cargo:warning=xcrun failed. Run: xcode-select --install"
            );
        }
    }
}