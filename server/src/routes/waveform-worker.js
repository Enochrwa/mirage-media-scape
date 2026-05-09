const { parentPort, workerData } = require('worker_threads');
const native = require('../../sonic-native.node');

try {
  const peaks = native.generateWaveform(workerData.filePath);
  parentPort.postMessage({ peaks });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
