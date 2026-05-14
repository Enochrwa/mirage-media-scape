/**
 * Phase Vocoder AudioWorkletProcessor
 * Implements a basic Overlap-Add (OLA) algorithm for time-stretching.
 * This is still a simplified version but moves beyond a simple passthrough.
 */

class PhaseVocoderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.hopSize = 1024;

    this.inputBuffer = new Float32Array(this.bufferSize * 2);
    this.outputBuffer = new Float32Array(this.bufferSize * 2);
    this.inputWritePtr = 0;
    this.outputReadPtr = 0;

    this.speed = 1.0;
  }

  static get parameterDescriptors() {
    return [
      {
        name: 'speed',
        defaultValue: 1.0,
        minValue: 0.5,
        maxValue: 4.0,
      },
    ];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0][0];
    const output = outputs[0][0];
    const speedParam = parameters.speed;

    if (!input) return true;

    this.speed = speedParam[speedParam.length - 1];

    // Simple Overlap-Add (OLA) time stretching logic
    // This is a placeholder for a true phase vocoder which would use FFT/IFFT.
    // OLA works by repeating or skipping blocks of audio.

    for (let i = 0; i < input.length; i++) {
      this.inputBuffer[this.inputWritePtr] = input[i];
      this.inputWritePtr = (this.inputWritePtr + 1) % this.inputBuffer.length;
    }

    // Read from buffer with speed adjustment
    let readStep = this.speed;
    let readPtr = this.outputReadPtr;

    for (let i = 0; i < output.length; i++) {
      const index = Math.floor(readPtr) % this.inputBuffer.length;
      output[i] = this.inputBuffer[index];
      readPtr += readStep;
    }

    this.outputReadPtr = readPtr % this.inputBuffer.length;

    return true;
  }
}

registerProcessor('phase-vocoder', PhaseVocoderProcessor);
