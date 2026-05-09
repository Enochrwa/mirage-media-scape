import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export const getFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpeg) {
    return ffmpeg;
  }
  ffmpeg = new FFmpeg();
  
  // This loads the core and wasm files from a CDN. 
  // No need to host them ourselves for this implementation.
  await ffmpeg.load();

  return ffmpeg;
};

export const trimAudio = async (
  audioUrl: string,
  startTime: number,
  endTime: number
): Promise<Blob> => {
  const ffmpegInstance = await getFFmpeg();
  const inputFileName = `input_${Date.now()}.audio`;
  const outputFileName = `output_${Date.now()}.audio`;

  // Fetch the file and write it to the virtual file system
  await ffmpegInstance.writeFile(inputFileName, await fetchFile(audioUrl));

  const command = [
    '-i',
    inputFileName,
    '-ss',
    String(startTime),
    '-to',
    String(endTime),
    '-c',
    'copy',
    outputFileName,
  ];

  console.log('Running ffmpeg command:', command.join(' '));

  // Run the ffmpeg command
  await ffmpegInstance.exec(command);

  // Read the result
  const data = await ffmpegInstance.readFile(outputFileName);

  // Clean up virtual files
  await ffmpegInstance.deleteFile(inputFileName);
  await ffmpegInstance.deleteFile(outputFileName);

  // Return as a blob
  return new Blob([data], { type: 'audio/wav' }); // Assuming wav, as the source is wav.
};

export const normalizeVolume = async (audioUrl: string): Promise<Blob> => {
  const ffmpegInstance = await getFFmpeg();
  const inputFileName = `input_norm_${Date.now()}.audio`;
  const outputFileName = `output_norm_${Date.now()}.audio`;

  await ffmpegInstance.writeFile(inputFileName, await fetchFile(audioUrl));

  // Using a single-pass loudnorm filter with common parameters.
  const command = [
    '-i',
    inputFileName,
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    outputFileName,
  ];

  console.log('Running ffmpeg command:', command.join(' '));

  await ffmpegInstance.exec(command);

  const data = await ffmpegInstance.readFile(outputFileName);
  
  await ffmpegInstance.deleteFile(inputFileName);
  await ffmpegInstance.deleteFile(outputFileName);

  return new Blob([data], { type: 'audio/wav' });
};

export const applyFade = async (
  audioUrl: string,
  audioDuration: number,
  fadeInDuration: number,
  fadeOutDuration: number
): Promise<Blob> => {
  const ffmpegInstance = await getFFmpeg();
  const inputFileName = `input_fade_${Date.now()}.audio`;
  const outputFileName = `output_fade_${Date.now()}.audio`;

  await ffmpegInstance.writeFile(inputFileName, await fetchFile(audioUrl));

  const fadeFilters: string[] = [];
  if (fadeInDuration > 0) {
    fadeFilters.push(`afade=t=in:st=0:d=${fadeInDuration}`);
  }
  if (fadeOutDuration > 0) {
    const fadeOutStartTime = audioDuration - fadeOutDuration;
    if (fadeOutStartTime > 0) {
        fadeFilters.push(`afade=t=out:st=${fadeOutStartTime}:d=${fadeOutDuration}`);
    }
  }

  if (fadeFilters.length === 0) {
      console.warn("No fade effect to apply.");
      const data = await ffmpegInstance.readFile(inputFileName);
      await ffmpegInstance.deleteFile(inputFileName);
      return new Blob([data], { type: 'audio/wav' });
  }

  const command = [
    '-i',
    inputFileName,
    '-af',
    fadeFilters.join(','),
    outputFileName,
  ];

  console.log('Running ffmpeg command:', command.join(' '));

  await ffmpegInstance.exec(command);

  const data = await ffmpegInstance.readFile(outputFileName);

  await ffmpegInstance.deleteFile(inputFileName);
  await ffmpegInstance.deleteFile(outputFileName);

  return new Blob([data], { type: 'audio/wav' });
};

export const changeVolume = async (audioUrl: string, gain: number): Promise<Blob> => {
  const ffmpegInstance = await getFFmpeg();
  const inputFileName = `input_vol_${Date.now()}.audio`;
  const outputFileName = `output_vol_${Date.now()}.audio`;

  await ffmpegInstance.writeFile(inputFileName, await fetchFile(audioUrl));

  const command = [
    '-i',
    inputFileName,
    '-af',
    `volume=${gain}dB`,
    outputFileName,
  ];
  
  console.log('Running ffmpeg command:', command.join(' '));

  await ffmpegInstance.exec(command);

  const data = await ffmpegInstance.readFile(outputFileName);
  
  await ffmpegInstance.deleteFile(inputFileName);
  await ffmpegInstance.deleteFile(outputFileName);

  return new Blob([data], { type: 'audio/wav' });
};
