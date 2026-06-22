import { EventEmitter } from 'events';
import { Writable } from 'stream';
import { RadioStreamProxy } from '../src/services/RadioStreamProxy.js';

/**
 * A fake upstream "response.data" stream: a Readable-shaped EventEmitter
 * the test can push chunks into and then end/error on demand, standing in
 * for what axios({ responseType: 'stream' }) would hand back.
 */
class FakeUpstreamStream extends EventEmitter {
  destroyCalled = false;
  destroy() {
    this.destroyCalled = true;
  }
  pipe(dest: NodeJS.WritableStream) {
    // Real stream semantics: feed data through .write()/.end() so a real
    // Transform (IcyMetadataParser) actually runs its _transform logic,
    // rather than bypassing it by emitting 'data' directly on dest.
    this.on('data', (c: Buffer) => dest.write(c));
    this.on('end', () => dest.end());
    this.on('close', () => (dest as unknown as EventEmitter).emit('close'));
    return dest;
  }
}

function makeFakeRequest(upstreams: FakeUpstreamStream[], headers: Record<string, string> = {}) {
  let call = 0;
  const calledUrls: string[] = [];
  const fn = async (config: { url: string }) => {
    calledUrls.push(config.url);
    const data = upstreams[Math.min(call, upstreams.length - 1)];
    call += 1;
    return { headers: { 'content-type': 'audio/mpeg', ...headers }, data };
  };
  return { fn, calledUrls };
}

class CollectingWritable extends Writable {
  chunks: Buffer[] = [];
  _write(chunk: Buffer, _enc: string, cb: (err?: Error) => void) {
    this.chunks.push(chunk);
    cb();
  }
  get totalBytes() {
    return this.chunks.reduce((sum, c) => sum + c.length, 0);
  }
}

describe('RadioStreamProxy', () => {
  it('forwards audio bytes from the upstream to the destination', async () => {
    const upstream = new FakeUpstreamStream();
    const { fn } = makeFakeRequest([upstream]);
    const dest = new CollectingWritable();

    const proxy = new RadioStreamProxy({
      url: 'https://example.com/stream',
      request: fn as never,
    });
    proxy.start(dest);

    await new Promise((r) => setImmediate(r));
    upstream.emit('data', Buffer.from('hello-audio'));
    await new Promise((r) => setImmediate(r));

    expect(dest.totalBytes).toBe(Buffer.from('hello-audio').length);
    proxy.destroy();
  });

  it('reconnects with backoff when the upstream ends, instead of stopping', async () => {
    const upstream1 = new FakeUpstreamStream();
    const upstream2 = new FakeUpstreamStream();
    const { fn, calledUrls } = makeFakeRequest([upstream1, upstream2]);
    const dest = new CollectingWritable();

    const proxy = new RadioStreamProxy({
      url: 'https://example.com/stream',
      reconnectDelaysMs: [5, 10, 20],
      request: fn as never,
    });
    proxy.start(dest);

    await new Promise((r) => setImmediate(r));
    upstream1.emit('data', Buffer.from('AAA'));
    upstream1.emit('end'); // simulate Icecast dropping the connection

    // Wait past the 5ms backoff for the reconnect to fire.
    await new Promise((r) => setTimeout(r, 50));
    upstream2.emit('data', Buffer.from('BBB'));
    await new Promise((r) => setImmediate(r));

    expect(calledUrls.length).toBeGreaterThanOrEqual(2);
    expect(dest.totalBytes).toBe(6); // 'AAA' + 'BBB'
    proxy.destroy();
  });

  it('only reconnects once when the upstream emits both end and close for a single drop', async () => {
    // Regression test: real Node streams fire BOTH 'end' and 'close' for
    // one termination (autoDestroy). An earlier version called
    // scheduleReconnect() for each, which either double-incremented the
    // backoff counter (burning through the retry budget twice as fast)
    // or, with a single-entry delay list, triggered onGiveUp prematurely
    // after just one real disconnect.
    const upstream1 = new FakeUpstreamStream();
    const upstream2 = new FakeUpstreamStream();
    const { fn, calledUrls } = makeFakeRequest([upstream1, upstream2]);
    const dest = new CollectingWritable();
    let giveUpCalls = 0;

    const proxy = new RadioStreamProxy({
      url: 'https://example.com/stream',
      reconnectDelaysMs: [20, 20, 20], // plenty of budget for ONE disconnect
      request: fn as never,
      onGiveUp: () => {
        giveUpCalls += 1;
      },
    });
    proxy.start(dest);

    await new Promise((r) => setImmediate(r));
    // Emit both events synchronously, exactly like a real autoDestroy'd
    // Node stream would for one disconnect.
    upstream1.emit('end');
    upstream1.emit('close');

    expect(proxy.reconnectAttempts).toBe(1); // not 2 — one disconnect, one increment

    await new Promise((r) => setTimeout(r, 60));

    expect(calledUrls.length).toBe(2); // initial connect + exactly one reconnect
    expect(giveUpCalls).toBe(0); // should not have exhausted a 3-attempt budget from 1 drop
    proxy.destroy();
  });

  it('alternates to the fallback URL on odd-numbered retry attempts', async () => {
    const upstream1 = new FakeUpstreamStream();
    const upstream2 = new FakeUpstreamStream();
    const upstream3 = new FakeUpstreamStream();
    const { fn, calledUrls } = makeFakeRequest([upstream1, upstream2, upstream3]);
    const dest = new CollectingWritable();

    const proxy = new RadioStreamProxy({
      url: 'https://primary.example.com/stream',
      fallbackUrl: 'https://fallback.example.com/stream',
      reconnectDelaysMs: [5, 5, 5],
      request: fn as never,
    });
    proxy.start(dest);

    await new Promise((r) => setImmediate(r));
    upstream1.emit('end');
    await new Promise((r) => setTimeout(r, 30));
    upstream2.emit('end');
    await new Promise((r) => setTimeout(r, 30));

    expect(calledUrls[0]).toBe('https://primary.example.com/stream');
    expect(calledUrls[1]).toBe('https://fallback.example.com/stream');
    proxy.destroy();
  });

  it('gives up and calls onGiveUp after exhausting all reconnect attempts', async () => {
    const upstreams = [
      new FakeUpstreamStream(),
      new FakeUpstreamStream(),
      new FakeUpstreamStream(),
    ];
    const { fn } = makeFakeRequest(upstreams);
    const dest = new CollectingWritable();
    let giveUpCalls = 0;

    const proxy = new RadioStreamProxy({
      url: 'https://example.com/stream',
      reconnectDelaysMs: [5, 5],
      stableConnectionMs: 10000,
      request: fn as never,
      onGiveUp: () => {
        giveUpCalls += 1;
      },
    });
    proxy.start(dest);

    await new Promise((r) => setImmediate(r));
    upstreams[0].emit('end');
    await new Promise((r) => setTimeout(r, 20));
    upstreams[1].emit('end');
    await new Promise((r) => setTimeout(r, 20));
    upstreams[2].emit('end');
    await new Promise((r) => setTimeout(r, 20));

    expect(giveUpCalls).toBe(1);
    proxy.destroy();
  });

  it('does not reconnect after destroy() has been called', async () => {
    const upstream = new FakeUpstreamStream();
    const { fn, calledUrls } = makeFakeRequest([upstream]);
    const dest = new CollectingWritable();

    const proxy = new RadioStreamProxy({
      url: 'https://example.com/stream',
      reconnectDelaysMs: [5],
      request: fn as never,
    });
    proxy.start(dest);
    await new Promise((r) => setImmediate(r));

    proxy.destroy();
    upstream.emit('end');
    await new Promise((r) => setTimeout(r, 30));

    expect(calledUrls.length).toBe(1); // no reconnect attempted
  });

  it('does NOT reset the backoff counter on a connection that drops immediately (before stableConnectionMs)', async () => {
    // Regression test: an earlier version reset `attempt` to 0 on every
    // successful *connect*, so a stream that connects fine but drops
    // again within milliseconds (a dead/flapping station) could retry
    // forever and never reach onGiveUp.
    const upstreams = Array.from({ length: 4 }, () => new FakeUpstreamStream());
    const { fn } = makeFakeRequest(upstreams);
    const dest = new CollectingWritable();
    let giveUpCalls = 0;

    const proxy = new RadioStreamProxy({
      url: 'https://example.com/stream',
      reconnectDelaysMs: [5, 5, 5],
      stableConnectionMs: 10000, // never reached within this test
      request: fn as never,
      onGiveUp: () => {
        giveUpCalls += 1;
      },
    });
    proxy.start(dest);

    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setImmediate(r));
      upstreams[Math.min(i, upstreams.length - 1)].emit('end');
      await new Promise((r) => setTimeout(r, 15));
    }

    expect(giveUpCalls).toBe(1);
    proxy.destroy();
  });

  it('reports parsed ICY metadata via onMetadata', async () => {
    const upstream = new FakeUpstreamStream();
    const { fn } = makeFakeRequest([upstream], { 'icy-metaint': '16' });
    const dest = new CollectingWritable();
    const titles: string[] = [];

    const proxy = new RadioStreamProxy({
      url: 'https://example.com/stream',
      request: fn as never,
      onMetadata: (t) => titles.push(t),
    });
    proxy.start(dest);
    await new Promise((r) => setImmediate(r));

    const audio = Buffer.alloc(16, 0x41);
    const titleText = "StreamTitle='Live Test';";
    const titleBytes = Buffer.from(titleText, 'utf8');
    const blocks = Math.ceil(titleBytes.length / 16);
    const metaPadded = Buffer.alloc(blocks * 16, 0);
    titleBytes.copy(metaPadded);
    const frame = Buffer.concat([audio, Buffer.from([blocks]), metaPadded]);

    upstream.emit('data', frame);
    await new Promise((r) => setImmediate(r));

    expect(titles).toEqual(['Live Test']);
    proxy.destroy();
  });
});
