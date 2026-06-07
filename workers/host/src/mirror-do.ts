/**
 * MirrorRoom Durable Object — real-time WebSocket relay for mobile mirroring.
 *
 * Each room is identified by a random slug. Desktop and mobile clients connect
 * via WebSocket and messages are broadcast to all other peers in the room.
 *
 * Uses the hibernation-safe WebSocket API (state.acceptWebSocket) so idle rooms
 * don't consume CPU.
 */

interface SessionInfo {
  id: string;
  device: 'desktop' | 'mobile';
  connectedAt: number;
}

export class MirrorRoom {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, SessionInfo>;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const device = (url.searchParams.get('device') as 'desktop' | 'mobile') || 'desktop';
      const id = crypto.randomUUID().slice(0, 8);

      this.state.acceptWebSocket(server);
      this.sessions.set(server, { id, device, connectedAt: Date.now() });

      // Notify existing peers about the new connection
      this.broadcast(
        {
          type: 'peer_joined',
          data: { device, peers: this.sessions.size },
          from: 'system',
          timestamp: Date.now(),
        },
        server,
      );

      // Send current state to the new connection
      server.send(
        JSON.stringify({
          type: 'connected',
          data: { id, peers: this.sessions.size },
          timestamp: Date.now(),
        }),
      );

      return new Response(null, { status: 101, webSocket: client });
    }

    // GET /info — room info (no WebSocket needed)
    return new Response(
      JSON.stringify({
        peers: this.sessions.size,
        devices: [...this.sessions.values()].map((s) => s.device),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    try {
      const msg = JSON.parse(message);
      const session = this.sessions.get(ws);
      if (!session) return;

      // Add metadata
      msg.from = session.device;
      msg.timestamp = Date.now();

      // Broadcast to all OTHER peers
      this.broadcast(msg, ws);
    } catch {
      // Ignore malformed messages
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);

    if (session) {
      this.broadcast({
        type: 'peer_left',
        data: { device: session.device, peers: this.sessions.size },
        from: 'system',
        timestamp: Date.now(),
      });
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws);
  }

  private broadcast(msg: unknown, exclude?: WebSocket): void {
    const data = JSON.stringify(msg);
    for (const [ws] of this.sessions) {
      if (ws !== exclude) {
        try {
          ws.send(data);
        } catch {
          this.sessions.delete(ws);
        }
      }
    }
  }
}
