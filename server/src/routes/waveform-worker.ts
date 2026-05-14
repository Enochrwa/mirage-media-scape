/**
 * Waveform worker — runs in a Worker thread.
 *
 * The native addon is CJS, so we keep one createRequire call here (same
 * pattern as native-loader.ts, but .js because worker_threads only resolves
 * compiled .js files at runtime).
 */
import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requireCjs = createRequire(__filename);
const native = requireCjs(path.resolve(__dirname, '../../../native/index.js'));

try {
  const peaks = native.generateWaveform(workerData.filePath);
  parentPort?.postMessage({ peaks });
} catch (error) {
  parentPort?.postMessage({ error: (error as Error).message });
}