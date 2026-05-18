#!/usr/bin/env tsx
/**
 * scripts/check-native.ts
 *
 * Automatically builds the NAPI-RS native addon if the platform binary
 * is missing.  Called by root package.json postinstall hook.
 *
 * Non-fatal: if Rust is missing or the build fails, the server starts in
 * stub mode with limited features rather than blocking the developer.
 */

import { execSync, execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname }          from 'node:path';
import { fileURLToPath }          from 'node:url';

// ZOVYRA_ROOT is injected by root package.json scripts.
// Fall back to resolving relative to this file.
const ROOT   = process.env['ZOVYRA_ROOT'] ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const NATIVE = join(ROOT, 'native');

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const c = { reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', gray: '\x1b[90m' };
const log = {
  ok:      (m: string) => console.log(`${c.green}✔${c.reset}  ${m}`),
  warn:    (m: string) => console.warn(`${c.yellow}⚠${c.reset}  ${m}`),
  step:    (m: string) => console.log(`${c.gray}   →${c.reset} ${m}`),
  heading: (m: string) => console.log(`\n${c.bold}${m}${c.reset}`),
};

// ── Platform binary detection ─────────────────────────────────────────────────
type PlatformMap = Record<string, Record<string, string>>;

function expectedBinary(): string | null {
  const { platform, arch } = process;
  const map: PlatformMap = {
    darwin:  { x64: 'zovyra-native.darwin-x64.node',           arm64: 'zovyra-native.darwin-arm64.node' },
    linux:   { x64: 'zovyra-native.linux-x64-gnu.node',        arm64: 'zovyra-native.linux-arm64-gnu.node',   arm: 'zovyra-native.linux-arm-gnueabihf.node' },
    win32:   { x64: 'zovyra-native.win32-x64-msvc.node',       arm64: 'zovyra-native.win32-arm64-msvc.node' },
    android: { arm64: 'zovyra-native.android-arm64.node' },
  };
  return map[platform]?.[arch] ?? null;
}

function binaryExists(): boolean {
  const specific = expectedBinary();
  if (specific && existsSync(join(NATIVE, specific))) return true;
  if (process.platform === 'darwin' && existsSync(join(NATIVE, 'zovyra-native.darwin-universal.node'))) return true;
  try { return readdirSync(NATIVE).some(f => f.endsWith('.node')); } catch { return false; }
}

function hasRust(): boolean {
  try { execFileSync('cargo', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

function hasNapiCli(): boolean {
  try { execSync('npx napi --version', { cwd: NATIVE, stdio: 'ignore' }); return true; } catch { return false; }
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main(): void {
  if (binaryExists()) {
    log.ok('Native addon ready.');
    return;
  }

  log.heading('Native addon not found — attempting to build…');

  if (!hasRust()) {
    log.warn('Rust/Cargo not found — skipping native build (stub mode).');
    log.step('Install Rust:  https://rustup.rs/');
    log.step('Then run:      npm run build:native');
    return;
  }

  if (!existsSync(join(NATIVE, 'node_modules'))) {
    log.step('Installing native npm dependencies…');
    try {
      execSync('npm install', { cwd: NATIVE, stdio: 'inherit' });
    } catch {
      log.warn('Failed to install native deps — stub mode.');
      log.step('Fix:  cd native && npm install');
      return;
    }
  }

  if (!hasNapiCli()) {
    log.warn('@napi-rs/cli not found — stub mode.');
    log.step('Fix:  cd native && npm install');
    return;
  }

  log.step('Compiling Rust → .node binary (first build: ~60–120 s, downloads FFmpeg source)…');
  try {
    execSync('npm run build', { cwd: NATIVE, stdio: 'inherit' });
  } catch (err) {
    log.warn('Native build failed — stub mode (limited features).');
    log.step(`Error: ${err instanceof Error ? err.message : String(err)}`);
    log.step('Retry:          cd native && npm run build');
    log.step('macOS prereqs:  brew install nasm');
    log.step('Linux prereqs:  sudo apt-get install build-essential clang libclang-dev nasm yasm');
    return;
  }

  if (!binaryExists()) {
    log.warn('Build finished but no .node binary found — stub mode.');
    return;
  }

  log.ok('Native addon built successfully.\n');
}

main();