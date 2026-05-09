import { WebSocketServer, WebSocket } from 'ws';

export class RemoteControlServer {
  private wss: WebSocketServer;
  private players: Set<WebSocket> = new Set();
  private remotes: Set<WebSocket> = new Set();

  constructor(port: number = 8765) {
    this.wss = new WebSocketServer({ port });
    this.init();
    console.log(`Remote Control Server listening on port ${port}`);
  }

  private init() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const type = url.searchParams.get('type'); // 'player' or 'remote'

      if (type === 'player') {
        this.players.add(ws);
        ws.on('close', () => this.players.delete(ws));
      } else {
        this.remotes.add(ws);
        ws.on('close', () => this.remotes.delete(ws));
      }

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          if (type === 'player') {
            // Broadcast state from player to all remotes
            this.broadcast(this.remotes, msg);
          } else {
            // Broadcast command from remote to all players
            this.broadcast(this.players, msg);
          }
        } catch (e) {
          console.error('Remote error', e);
        }
      });
    });
  }

  private broadcast(clients: Set<WebSocket>, msg: Record<string, unknown>) {
    const data = JSON.stringify(msg);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}
