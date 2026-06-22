import { IcyMetadataParser } from '../src/services/IcyMetadataParser.js';

/**
 * Builds a fake ICY-interleaved buffer: `audioLen` bytes of audio, then a
 * single length byte followed by `metaText` padded to a multiple of 16
 * bytes with NULs (mirroring how real Icecast/Shoutcast servers frame
 * metadata), then any trailing audio bytes supplied.
 */
function buildIcyFrame(audioBefore: number, metaText: string, audioAfter: Buffer): Buffer {
  const audio1 = Buffer.alloc(audioBefore, 0x41); // 'A' filler bytes
  const metaBytes = Buffer.from(metaText, 'utf8');
  const blocks = Math.ceil(metaBytes.length / 16);
  const paddedLength = blocks * 16;
  const metaPadded = Buffer.alloc(paddedLength, 0);
  metaBytes.copy(metaPadded);
  const lengthByte = Buffer.from([blocks]);
  return Buffer.concat([audio1, lengthByte, metaPadded, audioAfter]);
}

function collectAudio(parser: IcyMetadataParser, input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    parser.on('data', (c: Buffer) => chunks.push(c));
    parser.on('end', () => resolve(Buffer.concat(chunks)));
    parser.on('error', reject);
    parser.end(input);
  });
}

describe('IcyMetadataParser', () => {
  it('strips a metadata frame and forwards only audio bytes', async () => {
    const metaInt = 100;
    const audioAfter = Buffer.alloc(50, 0x42); // 'B' filler
    const frame = buildIcyFrame(metaInt, "StreamTitle='Test Station - Hit Song';", audioAfter);

    const parser = new IcyMetadataParser(metaInt);
    const titles: string[] = [];
    parser.on('metadata', (t: string) => titles.push(t));

    const audioOut = await collectAudio(parser, frame);

    expect(audioOut.length).toBe(metaInt + audioAfter.length);
    expect(titles).toEqual(['Test Station - Hit Song']);
  });

  it('handles a zero-length metadata block (no title change) without dropping audio', async () => {
    const metaInt = 64;
    const audio1 = Buffer.alloc(metaInt, 0x41);
    const audio2 = Buffer.alloc(64, 0x42);
    // length byte 0 == no metadata this interval
    const frame = Buffer.concat([audio1, Buffer.from([0]), audio2]);

    const parser = new IcyMetadataParser(metaInt);
    const titles: string[] = [];
    parser.on('metadata', (t: string) => titles.push(t));

    const audioOut = await collectAudio(parser, frame);

    expect(audioOut.length).toBe(audio1.length + audio2.length);
    expect(titles).toEqual([]);
  });

  it('parses metadata split across multiple chunks fed to _transform', async () => {
    const metaInt = 10;
    const frame = buildIcyFrame(metaInt, "StreamTitle='Chunked Title';", Buffer.alloc(10, 0x42));

    const parser = new IcyMetadataParser(metaInt);
    const titles: string[] = [];
    parser.on('metadata', (t: string) => titles.push(t));

    const chunks: Buffer[] = [];
    parser.on('data', (c: Buffer) => chunks.push(c));

    await new Promise<void>((resolve, reject) => {
      parser.on('end', resolve);
      parser.on('error', reject);
      // Feed the frame in small, arbitrary slices to simulate real network
      // chunking that splits a metadata block across multiple TCP reads.
      let offset = 0;
      const sliceSize = 3;
      const pump = () => {
        if (offset >= frame.length) {
          parser.end();
          return;
        }
        const slice = frame.subarray(offset, offset + sliceSize);
        offset += sliceSize;
        parser.write(slice);
        setImmediate(pump);
      };
      pump();
    });

    expect(titles).toEqual(['Chunked Title']);
    expect(Buffer.concat(chunks).length).toBe(metaInt + 10);
  });

  it('does not re-emit metadata when the title is unchanged across intervals', async () => {
    const metaInt = 20;
    const frame1 = buildIcyFrame(metaInt, "StreamTitle='Same Song';", Buffer.alloc(0));
    const frame2Meta = buildIcyFrame(metaInt, "StreamTitle='Same Song';", Buffer.alloc(0));
    const combined = Buffer.concat([frame1, frame2Meta]);

    const parser = new IcyMetadataParser(metaInt);
    const titles: string[] = [];
    parser.on('metadata', (t: string) => titles.push(t));

    await collectAudio(parser, combined);

    expect(titles).toEqual(['Same Song']);
  });
});
