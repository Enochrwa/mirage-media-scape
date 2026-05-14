const { parentPort, workerData } = require('worker_threads');
const native = require('../../../native/index.js');

try {
  const peaks = native.generateWaveform(workerData.filePath);
  parentPort.postMessage({ peaks });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
