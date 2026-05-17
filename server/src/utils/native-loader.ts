/**
 * server/src/utils/native-loader.ts
 *
 * Smart loader for the zovyra-native NAPI-RS addon.
 *
 * Load order:
 *   1. Try native/index.js → loads the compiled .node binary (full FFmpeg).
 *   2. On failure, fall back to native/stub-build.js → safe ESM stubs that
 *      let the server start without Rust / FFmpeg installed.
 *
 * This means `npm run dev` in server/ always works:
 *   • After `cd native && npm run build`  → real FFmpeg features
 *   • Without the native build            → stub mode (server still boots)
 */

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import type * as Native from '../../zovyra-native.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const requireCjs  = createRequire(__filename);
const nativeDir   = path.resolve(__dirname, '../../../native');
const nativeIndex = path.join(nativeDir, 'index.js');
const nativeStub  = path.join(nativeDir, 'stub-build.js');

/** Returns true if at least one compiled .node binary exists in native/ */
function binaryExists(): boolean {
  try {
    return readdirSync(nativeDir).some(f => f.endsWith('.node'));
  } catch {
    return false;
  }
}

let native: typeof Native;

if (binaryExists() && existsSync(nativeIndex)) {
  // ── Real native build ───────────────────────────────────────────────────
  try {
    native = requireCjs(nativeIndex) as typeof Native;
  } catch (err) {
    console.warn(
      '\x1b[33m[zovyra-native]\x1b[0m Failed to load compiled binary, ' +
      'falling back to stub mode.\n' +
      `  Reason: ${(err as Error).message}`
    );
    // Fall through to stub
    native = await import(pathToFileURL(nativeStub).href) as typeof Native;
  }
} else {
  // ── Stub mode (no native build yet) ────────────────────────────────────
  native = await import(pathToFileURL(nativeStub).href) as typeof Native;
}

export default native;