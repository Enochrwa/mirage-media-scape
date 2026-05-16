/**
 * ESM-compatible loader for the native NAPI-RS addon.
 *
 * The compiled addon (native/index.js) is a CommonJS module.  In an ESM
 * project the cleanest way to import a CJS file is with a `createRequire`
 * shim kept in one place so every consumer just does:
 *
 *   import native from '../utils/native-loader.js';
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type * as Native from '../../zovyra-native.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requireCjs = createRequire(__filename);
// Resolve relative to this file: src/utils/ → ../../native/index.js
const nativePath = path.resolve(__dirname, '../../../native/index.js');

const native = requireCjs(nativePath) as typeof Native;

export default native;
