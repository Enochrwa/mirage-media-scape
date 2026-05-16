/**
 * Waveform worker — runs in a Worker thread.
 *
 * This file is compiled to JS by tsc and placed at:
 *   dist/src/routes/waveform-worker.js
 *
 * The native addon loader uses createRequire so the CJS addon loads correctly
 * in an ESM Worker context.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requireCjs = createRequire(__filename);

// Compiled output tree:
//   dist/
//     src/
//       routes/waveform-worker.js   ← this file
//     native/
//       index.js                    ← native loader
// Adjust relative path accordingly: ../../native/index.js won't work from
// dist/src/routes/, so we walk up three levels to the project root and into
// the native package.
const nativePath = path.resolve(__dirname, '../../../native/index.js');
const native = requireCjs(nativePath) as { generateWaveform: (path: string) => number[] };

interface WorkerData {
  filePath: string;
  dbPath: string;
}

const { filePath } = workerData as WorkerData;

try {
  const peaks = native.generateWaveform(filePath) as number[];
  parentPort?.postMessage({ peaks });
} catch (error) {
  parentPort?.postMessage({ error: (error as Error).message });
}
