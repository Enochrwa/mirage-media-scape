#!/usr/bin/env node
/**
 * scripts/check-native.js
 *
 * Automatically builds the NAPI-RS native addon if the platform binary
 * is missing.  Called by the root package.json hooks:
 *   - postinstall  → runs after `npm install` in the root
 *   - predev       → runs before `npm run dev`
 *   - prebuild     → runs before `npm run build`
 *
 * Requirements for a full build:
 *   - Rust / Cargo  → https://rustup.rs
 *   - Node >= 18
 *
 * If Rust is NOT installed the script warns clearly and exits 0
 * (non-fatal) so CI environments that ship pre-built binaries keep working.
 */

import { execSync, execFileSync } from 'child_process';
import { existsSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const NATIVE    = join(ROOT, 'native');

// ─── ANSI helpers ────────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};
const log = {
  info:    (m) => console.log(`${c.cyan}ℹ${c.reset}  ${m}`),
  ok:      (m) => console.log(`${c.green}✔${c.reset}  ${m}`),
  warn:    (m) => console.warn(`${c.yellow}⚠${c.reset}  ${m}`),
  error:   (m) => console.error(`${c.red}✖${c.reset}  ${m}`),
  step:    (m) => console.log(`${c.gray}   →${c.reset} ${m}`),
  heading: (m) => console.log(`\n${c.bold}${m}${c.reset}`),
};

// ─── Platform binary name ────────────────────────────────────────────────────
function expectedBinary() {
  const { platform, arch } = process;
  const map = {
    darwin: { x64: 'zovyra-native.darwin-x64.node', arm64: 'zovyra-native.darwin-arm64.node' },
    linux:  { x64: 'zovyra-native.linux-x64-gnu.node', arm64: 'zovyra-native.linux-arm64-gnu.node', arm: 'zovyra-native.linux-arm-gnueabihf.node' },
    win32:  { x64: 'zovyra-native.win32-x64-msvc.node', arm64: 'zovyra-native.win32-arm64-msvc.node' },
    android: { arm64: 'zovyra-native.android-arm64.node' },
  };
  return map[platform]?.[arch] ?? null;
}

// ─── Checks ──────────────────────────────────────────────────────────────────
function binaryExists() {
  // 1. Exact platform binary
  const specific = expectedBinary();
  if (specific && existsSync(join(NATIVE, specific))) return true;

  // 2. macOS universal binary (covers both x64 and arm64)
  if (process.platform === 'darwin' &&
      existsSync(join(NATIVE, 'zovyra-native.darwin-universal.node'))) return true;

  // 3. Any .node file in the directory (covers unusual triples)
  try {
    return readdirSync(NATIVE).some(f => f.endsWith('.node'));
  } catch {
    return false;
  }
}

function hasRust() {
  try { execFileSync('cargo', ['--version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function hasNapiCli() {
  try {
    execSync('npx napi --version', { cwd: NATIVE, stdio: 'ignore' });
    return true;
  } catch { return false; }
}

// ─── Main ────────────────────────────────────────────────────────────────────
function main() {
  if (binaryExists()) {
    log.ok('Native addon ready.');
    return;
  }

  log.heading('Native addon not found — attempting to build…');

  // Rust check
  if (!hasRust()) {
    log.warn('Rust/Cargo not found. Skipping native build.');
    log.warn('To enable full audio analysis install Rust:');
    log.step('https://rustup.rs/');
    log.warn('Then run:  npm run build:native');
    // Exit 0 — non-fatal so `npm install` still succeeds in environments
    // that will supply a pre-built binary (Docker, CI, etc.)
    return;
  }

  // Make sure native node_modules exist
  if (!existsSync(join(NATIVE, 'node_modules'))) {
    log.step('Installing native npm dependencies…');
    try {
      execSync('npm install', { cwd: NATIVE, stdio: 'inherit' });
    } catch (err) {
      log.warn('Failed to install native deps – server will start in stub mode.');
      log.step('Fix:  cd native && npm install');
      return; // non-fatal
    }
  }

  // Verify napi CLI is available
  if (!hasNapiCli()) {
    log.warn('@napi-rs/cli not found – server will start in stub mode.');
    log.step('Fix:  cd native && npm install');
    return; // non-fatal
  }

  // Build  (FFmpeg is downloaded + compiled automatically – no system install needed)
  log.step('Compiling Rust → .node binary (first build takes ~60–120 s)…');
  log.step('FFmpeg source will be downloaded and compiled – no system-wide install needed.');
  try {
    execSync('npm run build', { cwd: NATIVE, stdio: 'inherit' });
  } catch (err) {
    log.warn('Native build failed – server will start in stub mode (limited features).');
    log.warn(err.message ?? err);
    log.step('To retry:            cd native && npm run build');
    log.step('macOS prereqs:       brew install nasm');
    log.step('Linux prereqs:       apt-get install build-essential nasm yasm');
    return; // non-fatal
  }

  // Verify the binary actually appeared
  if (!binaryExists()) {
    log.warn('Build finished but no .node binary found – starting in stub mode.');
    log.step('Check the NAPI-RS output above for clues.');
    return; // non-fatal
  }

  log.ok('Native addon built successfully.\n');
}

main();