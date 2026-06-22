import axios from 'axios';
import type { Writable } from 'stream';
import { IcyMetadataParser } from './IcyMetadataParser.js';

export interface RadioStreamProxyOptions {
  /** Already-validated primary stream URL. */
  url: string;
  /** Already-validated fallback stream URL, tried on alternating retries. */
  fallbackUrl?: string | null;
  /** Backoff delays (ms) between reconnect attempts. */
  reconnectDelaysMs?: number[];
  /**
   * How long (ms) a connection must remain open before the backoff counter
   * resets. Defaults to 3000ms. Set lower in tests for speed.
   */
  stableConnectionMs?: number;
  /** Called once, the first time upstream headers arrive successfully. */
  onHeaders?: (contentType: string) => void;
  /** Called with each parsed ICY "now playing" title. */
  onMetadata?: (title: string) => void;
  /** Called when retries are exhausted and the proxy is giving up. */
  onGiveUp?: () => void;
  /** Injectable for tests; defaults to axios's request function. */
  request?: typeof axios.request;
}

const DEFAULT_RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000, 15000];

/**
 * Owns a single long-lived live-radio connection: connects to an upstream
 * Icecast/Shoutcast stream, strips interleaved ICY metadata, and writes
 * clean audio bytes to a destination stream. When the upstream connection
 * drops — which Icecast/Shoutcast servers do periodically even while still
 * broadcasting — it reconnects with exponential backoff (alternating to a
 * fallback URL if one was supplied) instead of treating the drop as the end
 * of the stream. `destroy()` stops everything and is idempotent.
 */
export class RadioStreamProxy {
  private readonly opts: RadioStreamProxyOptions & { request: typeof axios.request };
  private destination: Writable | null = null;
  private destroyed = false;
  private attempt = 0;
  private currentAbort: AbortController | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private stableTimeout: ReturnType<typeof setTimeout> | null = null;
  private headersAnnounced = false;

  /**
   * How long a connection must stay open before it counts as "stable" and
   * resets the backoff counter. Without this, a station that connects
   * successfully but drops again within milliseconds (a genuinely dead or
   * flapping stream — not a healthy one hitting a routine Icecast idle
   * timeout) would reset `attempt` to 0 on every single connect and could
   * retry forever, never reaching `onGiveUp`.
   */
  private readonly stableConnectionMs: number;

  constructor(opts: RadioStreamProxyOptions) {
    this.opts = {
      reconnectDelaysMs: DEFAULT_RECONNECT_DELAYS_MS,
      request: axios.request.bind(axios) as typeof axios.request,
      ...opts,
    };
    this.stableConnectionMs = opts.stableConnectionMs ?? 3000;
  }

  /** Begin streaming into `destination`. */
  start(destination: Writable): void {
    this.destination = destination;
    void this.connect();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    if (this.stableTimeout) clearTimeout(this.stableTimeout);
    this.currentAbort?.abort();
  }

  get reconnectAttempts(): number {
    return this.attempt;
  }

  private urlForAttempt(): string {
    if (this.opts.fallbackUrl && this.attempt % 2 === 1) return this.opts.fallbackUrl;
    return this.opts.url;
  }

  private async connect(): Promise<void> {
    if (this.destroyed) return;
    const targetUrl = this.urlForAttempt();
    const abort = new AbortController();
    this.currentAbort = abort;

    try {
      const response = await this.opts.request({
        method: 'get',
        url: targetUrl,
        responseType: 'stream',
        signal: abort.signal,
        timeout: 15000,
        headers: { 'Icy-MetaData': '1', 'User-Agent': 'Zovyra/1.0' },
      });

      if (this.destroyed) {
        response.data.destroy?.();
        return;
      }

      // Only reset the backoff counter once the connection has proven
      // stable for a little while — see `stableConnectionMs` above for why
      // an immediate reset on every connect would defeat onGiveUp.
      if (this.stableTimeout) clearTimeout(this.stableTimeout);
      this.stableTimeout = setTimeout(() => {
        this.stableTimeout = null;
        this.attempt = 0;
      }, this.stableConnectionMs);

      if (!this.headersAnnounced) {
        this.headersAnnounced = true;
        this.opts.onHeaders?.((response.headers['content-type'] as string) || 'audio/mpeg');
      }

      const metaIntHeader = response.headers['icy-metaint'];
      const metaInt = metaIntHeader ? parseInt(metaIntHeader as string, 10) : 0;

      let upstream: NodeJS.ReadableStream = response.data;
      if (metaInt > 0) {
        const parser = new IcyMetadataParser(metaInt);
        parser.on('metadata', (title: string) => this.opts.onMetadata?.(title));
        upstream = response.data.pipe(parser);
      }

      upstream.on('data', (chunk: Buffer) => {
        if (!this.destroyed) this.destination?.write(chunk);
      });

      let endHandled = false;
      const handleUpstreamEnd = () => {
        if (this.destroyed || endHandled) return;
        // Real Node streams emit BOTH 'end' and 'close' for a single
        // termination (autoDestroy fires 'close' shortly after 'end').
        // Without this guard, one actual disconnect would call
        // scheduleReconnect() twice, silently burning through the backoff
        // budget at double speed.
        endHandled = true;
        this.scheduleReconnect();
      };

      upstream.on('end', handleUpstreamEnd);
      upstream.on('close', handleUpstreamEnd);
      response.data.on('error', () => {
        if (!this.destroyed) handleUpstreamEnd();
      });
    } catch (_err) {
      if (this.destroyed) return;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.stableTimeout) {
      clearTimeout(this.stableTimeout);
      this.stableTimeout = null;
    }
    const delays = this.opts.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS_MS;
    if (this.attempt >= delays.length) {
      this.opts.onGiveUp?.();
      return;
    }
    const delay = delays[this.attempt];
    this.attempt += 1;
    this.retryTimeout = setTimeout(() => {
      this.retryTimeout = null;
      void this.connect();
    }, delay);
  }
}
