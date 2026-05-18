/**
 * server/src/utils/native-loader.ts
 *
 * Loads the zovyra-native NAPI-RS addon with graceful stub fallback.
 *
 * ## Path resolution strategy
 *
 * Counting "../../../" levels is fragile — the correct depth changes depending
 * on whether tsx runs source directly, tsc compiled to dist/, or a test runner
 * imports the file. Instead we locate the monorepo root using two strategies:
 *
 *   1. ZOVYRA_ROOT env var — injected by root package.json scripts via
 *      `ZOVYRA_ROOT=$(pwd) npm run dev`. Zero ambiguity, always correct.
 *
 *   2. Directory-walk fallback — walks up from process.cwd() looking for a
 *      directory that contains both `native/` and `server/` subdirectories.
 *      Works when starting the server directly without the root scripts.
 *
 * ## Load order
 *   1. Real .node binary  (full FFmpeg feature set)
 *   2. stub-build.js      (server boots, returns safe defaults)
 */

import { createRequire }                   from 'node:module';
import { pathToFileURL, fileURLToPath }  from 'node:url';
import path                        from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import type * as NativeTypes       from '../../zovyra-native.js';

// ── Locate monorepo root ─────────────────────────────────────────────────────

function findMonorepoRoot(): string {
  const hasNativeAndServer = (dir: string) =>
    existsSync(path.join(dir, 'native')) && existsSync(path.join(dir, 'server'));

  // Strategy 1: ZOVYRA_ROOT env var (set by root npm scripts)
  const fromEnv = process.env['ZOVYRA_ROOT'];
  if (fromEnv && hasNativeAndServer(fromEnv)) return fromEnv;

  // Strategy 2: walk up from cwd
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (hasNativeAndServer(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

// Strategy 3: walk up from this file's directory at runtime
  // import.meta.url is always available in ESM; derive dirname from it
  const selfDir = path.dirname(fileURLToPath(import.meta.url));

  let candidate = selfDir;
  for (let i = 0; i < 10; i++) {
    if (hasNativeAndServer(candidate)) return candidate;
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }

  throw new Error(
    '[zovyra-native] Cannot locate monorepo root.\n' +
    '  Preferred:  run from repo root with  npm run dev\n' +
    '  Manual:     ZOVYRA_ROOT=/path/to/zovyra npm run dev:server'
  );
}

// ── Resolve native package paths ─────────────────────────────────────────────

const repoRoot    = findMonorepoRoot();
const nativeDir   = path.join(repoRoot, 'native');
const nativeIndex = path.join(nativeDir, 'index.js');
const nativeStub  = path.join(nativeDir, 'stub-build.js');

function binaryExists(): boolean {
  try {
    return readdirSync(nativeDir).some((f: string) => f.endsWith('.node'));
  } catch {
    return false;
  }
}

// ── Load binary or stub ───────────────────────────────────────────────────────

const requireCjs = createRequire(import.meta.url);

async function loadNative(): Promise<typeof NativeTypes> {
  if (binaryExists() && existsSync(nativeIndex)) {
    try {
      return requireCjs(nativeIndex) as typeof NativeTypes;
    } catch (err) {
      console.warn(
        '\x1b[33m[zovyra-native]\x1b[0m Binary found but failed to load — using stub.\n' +
        `  Reason: ${(err as Error).message}`
      );
    }
  }
  return import(pathToFileURL(nativeStub).href) as Promise<typeof NativeTypes>;
}

const native = await loadNative();

export default native;