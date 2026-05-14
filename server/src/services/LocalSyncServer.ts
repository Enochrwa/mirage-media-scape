import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import mdns from 'multicast-dns';
import db from '../db/index.js';
import type { SyncLog, Setting } from '../types/database.js';

interface SyncEvent {
  type: string;
  payload: unknown;
  deviceId?: string;
}

export class LocalSyncServer {
  private wss: WebSocketServer;
  private deviceId: string;
  private clients: Set<WebSocket> = new Set();
  private mdnsServer: mdns.MulticastDNS;

  constructor(port: number = 8766) {
    this.wss = new WebSocketServer({ port });
    this.deviceId = this.getDeviceId();
    this.init();
    this.mdnsServer = mdns();
    this.initDiscovery(port);
    console.log(`Sync Server listening on port ${port}`);
  }

  private getDeviceId(): string {
    const idRow = db.prepare("SELECT value FROM settings WHERE key = 'device_id'").get() as
      | Setting
      | undefined;

    if (!idRow) {
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO settings (key, value) VALUES ('device_id', ?)").run(id);
      return id;
    }

    return idRow.value || crypto.randomUUID();
  }

  private initDiscovery(port: number): void {
    this.mdnsServer.on('query', (query) => {
      if (query.questions.some((q) => q.name === '_zovyra-sync._tcp.local')) {
        this.mdnsServer.respond({
          answers: [
            {
              name: '_zovyra-sync._tcp.local',
              type: 'PTR',
              data: 'zovyra-player._zovyra-sync._tcp.local',
            },
            {
              name: 'zovyra-player._zovyra-sync._tcp.local',
              type: 'SRV',
              data: { port, target: 'zovyra-player.local', priority: 0, weight: 0 },
            },
            {
              name: 'zovyra-player._zovyra-sync._tcp.local',
              type: 'TXT',
              data: [`id=${this.deviceId}`],
            },
          ],
        });
      }
    });
  }

  private init(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url ?? '', `http://${req.headers.host}`);
      const since = parseInt(url.searchParams.get('since') ?? '0', 10);

      // Send missed events
      const missedEvents = db
        .prepare('SELECT * FROM sync_log WHERE timestamp > ? AND device_id != ?')
        .all(since, this.deviceId) as SyncLog[];
      ws.send(JSON.stringify({ type: 'SYNC_HISTORY', events: missedEvents }));

      this.clients.add(ws);

      ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString()) as SyncEvent;
          this.handleEvent(event, ws);
        } catch (e) {
          console.error('Failed to parse sync event', e);
        }
      });

      ws.on('close', () => this.clients.delete(ws));
    });
  }

  private handleEvent(event: SyncEvent, sender: WebSocket): void {
    const timestamp = Date.now();
    const eventId = crypto.randomUUID();

    // Persist to log
    db.prepare(
      'INSERT INTO sync_log (event_id, type, payload, device_id, timestamp) VALUES (?, ?, ?, ?, ?)',
    ).run(
      eventId,
      event.type,
      JSON.stringify(event.payload),
      event.deviceId ?? 'unknown',
      timestamp,
    );

    // Broadcast to other connected clients
    const broadcastMsg = JSON.stringify({ ...event, id: eventId, timestamp });
    this.clients.forEach((client) => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(broadcastMsg);
      }
    });
  }
}