/**
 * Mobile Mirror — pair mobile with desktop agent tab.
 * Desktop shows QR code / link -> mobile scans -> both see results in real-time.
 * Uses WebSocket via the MirrorRoom Durable Object for cross-device relay.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface MirrorConfig {
  agentId: string;
  /** Base URL for the mirror relay API. Defaults to current origin or https://freebiostore.online */
  apiBase?: string;
  onMessage?: (msg: MirrorMessage) => void;
  onPeerConnected?: () => void;
  onPeerDisconnected?: () => void;
}

export interface MirrorMessage {
  type: 'result' | 'status' | 'input' | 'config';
  data: unknown;
  timestamp: number;
  from: 'desktop' | 'mobile' | 'system';
}

export interface MirrorInstance {
  /** The room ID (8 chars). */
  readonly roomId: string;

  /** URL that mobile scans / visits. */
  getQRUrl(): string;
  getMobileUrl(): string;
  isConnected(): boolean;
  readonly peerCount: number;

  /** Send an arbitrary message. */
  send(msg: Omit<MirrorMessage, 'timestamp'>): void;
  /** Shorthand: send a result payload. */
  sendResult(data: unknown): void;
  /** Shorthand: send a status string. */
  sendStatus(status: string): void;

  /** Stop WebSocket, clean up. */
  destroy(): void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // no ambiguous chars

export function generateRoomId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => CHARS[b % CHARS.length]).join('');
}

function getDefaultBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://freebiostore.online';
}

const RECONNECT_DELAY = 3000;

// ── Factory (desktop side) ───────────────────────────────────────────────────

export function createMirror(config: MirrorConfig): MirrorInstance {
  const apiBase = (config.apiBase ?? getDefaultBase()).replace(/\/$/, '');
  const roomId = generateRoomId();
  const role = 'desktop' as const;

  let destroyed = false;
  let _peerCount = 0;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connectWS(): void {
    if (destroyed) return;
    const wsUrl = `${apiBase.replace(/^http/, 'ws')}/v1/mirror/${roomId}/ws?device=${role}`;
    ws = new WebSocket(wsUrl);

    ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(ev.data) as Record<string, unknown>;
        const type = raw.type as string;
        const data = raw.data as Record<string, unknown> | undefined;

        if (type === 'connected') {
          _peerCount = (data?.peers as number) ?? 0;
        } else if (type === 'peer_joined') {
          _peerCount = (data?.peers as number) ?? _peerCount + 1;
          config.onPeerConnected?.();
        } else if (type === 'peer_left') {
          _peerCount = (data?.peers as number) ?? Math.max(0, _peerCount - 1);
          if (_peerCount <= 1) config.onPeerDisconnected?.();
        } else if (raw.from !== role) {
          config.onMessage?.(raw as unknown as MirrorMessage);
        }
      } catch {
        /* ignore malformed */
      }
    };

    ws.onclose = () => {
      if (!destroyed) {
        reconnectTimer = setTimeout(connectWS, RECONNECT_DELAY);
      }
    };
  }

  connectWS();

  const instance: MirrorInstance = {
    roomId,

    getQRUrl(): string {
      return `${apiBase}/mirror/?room=${roomId}&agent=${encodeURIComponent(config.agentId)}`;
    },

    getMobileUrl(): string {
      return `${apiBase}/mirror/?room=${roomId}&agent=${encodeURIComponent(config.agentId)}`;
    },

    isConnected(): boolean {
      return _peerCount > 1;
    },

    get peerCount() {
      return _peerCount;
    },

    send(msg: Omit<MirrorMessage, 'timestamp'>): void {
      if (destroyed) return;
      const full = { ...msg, timestamp: Date.now() };
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(full));
      }
    },

    sendResult(data: unknown): void {
      instance.send({ type: 'result', data, from: role });
    },

    sendStatus(status: string): void {
      instance.send({ type: 'status', data: status, from: role });
    },

    destroy(): void {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      if (ws) {
        ws.close();
        ws = null;
      }
    },
  };

  return instance;
}

// ── Mobile-side mirror (used by the mirror page) ─────────────────────────────

export interface MobileMirrorConfig {
  roomId: string;
  agentId: string;
  apiBase?: string;
  onMessage?: (msg: MirrorMessage) => void;
  onConnected?: () => void;
}

export interface MobileMirrorInstance {
  send(msg: Omit<MirrorMessage, 'timestamp'>): void;
  sendInput(data: unknown): void;
  destroy(): void;
}

export function joinMirror(config: MobileMirrorConfig): MobileMirrorInstance {
  const apiBase = (config.apiBase ?? getDefaultBase()).replace(/\/$/, '');
  const { roomId } = config;
  const role = 'mobile' as const;

  let destroyed = false;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connectWS(): void {
    if (destroyed) return;
    const wsUrl = `${apiBase.replace(/^http/, 'ws')}/v1/mirror/${roomId}/ws?device=${role}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      config.onConnected?.();
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as MirrorMessage;
        if (msg.from !== role) config.onMessage?.(msg);
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      if (!destroyed) {
        reconnectTimer = setTimeout(connectWS, RECONNECT_DELAY);
      }
    };
  }

  connectWS();

  const inst: MobileMirrorInstance = {
    send(msg: Omit<MirrorMessage, 'timestamp'>): void {
      if (destroyed) return;
      const full = { ...msg, timestamp: Date.now() };
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(full));
      }
    },

    sendInput(data: unknown): void {
      inst.send({ type: 'input', data, from: role });
    },

    destroy(): void {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      if (ws) {
        ws.close();
        ws = null;
      }
    },
  };

  return inst;
}
