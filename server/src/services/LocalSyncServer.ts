import { WebSocketServer, WebSocket } from 'ws';
import db from '../db';
import crypto from 'crypto';
import mdns from 'multicast-dns';
import { SyncLog, Setting } from '../types/database';

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
        const idRow = db.prepare("SELECT value FROM settings WHERE key = 'device_id'").get() as Setting | undefined;
        let id: string;
        if (!idRow) {
            id = crypto.randomUUID();
            db.prepare("INSERT INTO settings (key, value) VALUES ('device_id', ?)").run(id);
        } else {
            id = idRow.value || crypto.randomUUID();
        }
        return id;
    }

    private initDiscovery(port: number) {
        this.mdnsServer.on('query', (query) => {
            if (query.questions.some((q) => q.name === '_sonic-sync._tcp.local')) {
                this.mdnsServer.respond({
                    answers: [{
                        name: '_sonic-sync._tcp.local',
                        type: 'PTR',
                        data: 'sonic-player._sonic-sync._tcp.local'
                    }, {
                        name: 'sonic-player._sonic-sync._tcp.local',
                        type: 'SRV',
                        data: { port, target: 'sonic-player.local', priority: 0, weight: 0 }
                    }, {
                        name: 'sonic-player._sonic-sync._tcp.local',
                        type: 'TXT',
                        data: [`id=${this.deviceId}`]
                    }]
                });
            }
        });
    }

    private init() {
        this.wss.on('connection', (ws: WebSocket, req) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const since = parseInt(url.searchParams.get('since') || '0');

            // Send missed events
            const missedEvents = db.prepare('SELECT * FROM sync_log WHERE timestamp > ? AND device_id != ?').all(since, this.deviceId) as SyncLog[];
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

    private handleEvent(event: SyncEvent, sender: WebSocket) {
        const timestamp = Date.now();
        const eventId = crypto.randomUUID();

        // 1. Persist to log
        db.prepare('INSERT INTO sync_log (id, type, payload, device_id, timestamp) VALUES (?, ?, ?, ?, ?)')
            .run(eventId, event.type, JSON.stringify(event.payload), event.deviceId || 'unknown', timestamp);

        // 2. Broadcast to others
        const broadcastMsg = JSON.stringify({ ...event, id: eventId, timestamp });
        this.clients.forEach(client => {
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                client.send(broadcastMsg);
            }
        });
    }
}
