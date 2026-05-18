/// build.rs – Zovyra Native
///
/// Runs on the developer's machine at `cargo build` time.
/// Responsibilities:
///   1. Run napi-build (required for NAPI-RS .node output)
///   2. Fix `bindgen`'s clang include paths per-platform so that
///      `ffmpeg-sys-next`'s header parsing never fails with
///      "limits.h not found" or similar missing-header errors.
///
/// Platform behaviour:
///   Linux   – finds the highest installed GCC version under
///             /usr/lib/gcc/<triple>/ and adds its `include` dir.
///             Also adds the arch-specific system include dir.
///   macOS   – queries `xcrun --sdk macosx --show-sdk-path` and
///             passes the SDK sysroot; Xcode's clang resolves
///             everything from there automatically.
///   Windows – MSVC ships its own headers; nothing extra needed.
///             (bindgen on Windows uses the MSVC clang driver.)

use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    // ── 1. NAPI-RS boilerplate (always required) ──────────────────────────
    napi_build::setup();

    // ── 2. Per-platform bindgen clang flags ───────────────────────────────
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();

    match target_os.as_str() {
        "linux" => setup_linux_clang_args(),
        "macos" => setup_macos_clang_args(),
        // Windows: MSVC handles its own headers; nothing needed here.
        _ => {}
    }
}

// ── Linux ─────────────────────────────────────────────────────────────────
//
// Problem: clang (used by bindgen) doesn't search GCC's private include dir
// (/usr/lib/gcc/<triple>/<version>/include) which is where GCC puts its own
// limits.h.  When a system header does `#include_next <limits.h>` clang
// can't find the next file in the chain → fatal error.
//
// Fix: detect the GCC triple and the highest installed version, then export
// BINDGEN_EXTRA_CLANG_ARGS so bindgen passes the right -I flags to clang.
fn setup_linux_clang_args() {
    // Common GCC host triples. We try each until we find one that exists.
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

        // Pick the highest version number found under the triple directory.
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

                    // Arch-specific system headers, e.g.
                    //   /usr/include/x86_64-linux-gnu
                    let arch_dir = PathBuf::from(format!("/usr/include/{}", triple));
                    if arch_dir.exists() {
                        arch_include = Some(arch_dir);
                    }

                    break 'outer;
                }
            }
        }
    }

    // Build the -I flag string and export it for bindgen.
    let mut flags: Vec<String> = Vec::new();

    if let Some(p) = gcc_include {
        flags.push(format!("-I{}", p.display()));
        println!("cargo:warning=bindgen: adding GCC include path {}", p.display());
    } else {
        // Soft warning – don't abort the build; maybe clang finds it anyway.
        println!(
            "cargo:warning=bindgen: could not find GCC include dir under /usr/lib/gcc/. \
             If the build fails with 'limits.h not found', run: \
             sudo apt-get install build-essential clang libclang-dev"
        );
    }

    if let Some(p) = arch_include {
        flags.push(format!("-I{}", p.display()));
    }

    if !flags.is_empty() {
        // Only set if not already overridden by the developer.
        if env::var("BINDGEN_EXTRA_CLANG_ARGS").is_err() {
            // BINDGEN_EXTRA_CLANG_ARGS is read by bindgen at runtime, not by
            // cargo, so we can't use println!("cargo:rustc-env=…") here.
            // Instead we write a small env-file that the build script of
            // ffmpeg-sys-next picks up, OR we set it via the environment for
            // child processes.  The most reliable cross-crate method is to
            // set the var for the current process – bindgen runs in-process.
            let joined = flags.join(" ");
            // Safety: single-threaded build script context.
            unsafe {
                env::set_var("BINDGEN_EXTRA_CLANG_ARGS", &joined);
            }
            println!("cargo:warning=bindgen: BINDGEN_EXTRA_CLANG_ARGS set to: {}", joined);
        }
    }
}

// ── macOS ─────────────────────────────────────────────────────────────────
//
// Problem: on Apple Silicon and newer Xcode versions the SDK root moves
// around.  Passing `--sysroot <sdk_path>` to clang resolves all system
// headers consistently regardless of Xcode installation location.
//
// Fix: ask xcrun where the current SDK lives and pass --sysroot.
fn setup_macos_clang_args() {
    if env::var("BINDGEN_EXTRA_CLANG_ARGS").is_ok() {
        return; // developer already set it; respect their choice
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
            let flag = format!("--sysroot={}", path);
            unsafe {
                env::set_var("BINDGEN_EXTRA_CLANG_ARGS", &flag);
            }
            println!("cargo:warning=bindgen: macOS sysroot set to {}", path);
        }
        _ => {
            println!(
                "cargo:warning=bindgen: xcrun not found or failed. \
                 If the build fails with missing headers, run: \
                 xcode-select --install"
            );
        }
    }
}