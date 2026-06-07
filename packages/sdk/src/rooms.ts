/** Real-time rooms via WebSocket — vendored from FAS SDK pattern. */
export class Rooms {
  private apiBase: string;
  private agentId: string;

  constructor(apiBase: string, agentId: string) {
    this.apiBase = apiBase;
    this.agentId = agentId;
  }

  create(roomId: string): Room {
    const wsUrl = this.apiBase.replace('https://', 'wss://').replace('http://', 'ws://');
    return new Room(`${wsUrl}/v1/rooms?app=${this.agentId}&room=${roomId}`);
  }
}

export class Room {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers = new Map<string, Set<(data: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    this.ws = new WebSocket(this.url);
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      const listeners = this.handlers.get(msg.type) ?? this.handlers.get('*');
      if (listeners) for (const fn of listeners) fn(msg.data);
    };
  }

  send(type: string, data: unknown): void {
    this.ws?.send(JSON.stringify({ type, data }));
  }

  on(type: string, fn: (data: unknown) => void): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
