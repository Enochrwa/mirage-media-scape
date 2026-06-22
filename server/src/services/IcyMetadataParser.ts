import { Transform, TransformCallback } from 'stream';

/**
 * Parses interleaved ICY ("Icy-MetaData") frames out of a Shoutcast/Icecast
 * audio stream and forwards clean audio bytes downstream.
 *
 * When a server responds to a request with `Icy-MetaData: 1` and advertises
 * an `icy-metaint: N` header, it interleaves a metadata block every N bytes
 * of audio: a single length byte (L) followed by L*16 bytes of ASCII text,
 * typically `StreamTitle='...';StreamUrl='...';`. Without stripping this out
 * before handing bytes to an <audio> element, the metadata bytes corrupt the
 * audio stream (audible clicks/garbage) — this transform removes them and
 * surfaces the parsed title via the `metadata` event instead.
 */
export class IcyMetadataParser extends Transform {
  private readonly metaInt: number;
  private bytesUntilMeta: number;
  private inMetaBlock = false;
  private metaBlockRemaining = 0;
  private metaBuffer: Buffer[] = [];
  private lastTitle: string | null = null;

  constructor(metaInt: number) {
    super();
    this.metaInt = metaInt;
    this.bytesUntilMeta = metaInt;
  }

  get currentTitle(): string | null {
    return this.lastTitle;
  }

  _transform(chunk: Buffer, _encoding: string, callback: TransformCallback): void {
    let offset = 0;
    const audioChunks: Buffer[] = [];

    while (offset < chunk.length) {
      if (this.inMetaBlock) {
        const take = Math.min(this.metaBlockRemaining, chunk.length - offset);
        this.metaBuffer.push(chunk.subarray(offset, offset + take));
        this.metaBlockRemaining -= take;
        offset += take;

        if (this.metaBlockRemaining === 0) {
          this.inMetaBlock = false;
          this.handleMetaBlock(Buffer.concat(this.metaBuffer));
          this.metaBuffer = [];
          this.bytesUntilMeta = this.metaInt;
        }
        continue;
      }

      if (this.bytesUntilMeta > 0) {
        const take = Math.min(this.bytesUntilMeta, chunk.length - offset);
        audioChunks.push(chunk.subarray(offset, offset + take));
        this.bytesUntilMeta -= take;
        offset += take;
        continue;
      }

      // bytesUntilMeta === 0: next byte is the metadata length byte.
      const lengthByte = chunk[offset];
      offset += 1;
      const metaLength = lengthByte * 16;

      if (metaLength === 0) {
        // No metadata this interval — resume audio immediately.
        this.bytesUntilMeta = this.metaInt;
        continue;
      }

      this.inMetaBlock = true;
      this.metaBlockRemaining = metaLength;
    }

    if (audioChunks.length > 0) {
      this.push(Buffer.concat(audioChunks));
    }
    callback();
  }

  private handleMetaBlock(buf: Buffer): void {
    // Trailing NUL padding is part of the spec — trim it before parsing.
    const text = buf.toString('utf8').replace(/\0+$/, '');
    const match = /StreamTitle=['"](.*?)['"];/.exec(text);
    if (match) {
      const title = match[1].trim();
      if (title && title !== this.lastTitle) {
        this.lastTitle = title;
        this.emit('metadata', title);
      }
    }
  }
}
