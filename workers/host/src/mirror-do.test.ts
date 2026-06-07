import { describe, expect, it, vi } from 'vitest';
import { MirrorRoom } from './mirror-do';

function createMockState() {
  return {
    acceptWebSocket: vi.fn(),
  } as unknown as DurableObjectState;
}

describe('MirrorRoom', () => {
  it('returns room info with zero peers on GET', async () => {
    const state = createMockState();
    const room = new MirrorRoom(state);
    const res = await room.fetch(new Request('https://example.com/info'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { peers: number; devices: string[] };
    expect(body.peers).toBe(0);
    expect(body.devices).toEqual([]);
  });

  it('returns JSON content type on room info', async () => {
    const state = createMockState();
    const room = new MirrorRoom(state);
    const res = await room.fetch(new Request('https://example.com/info'));
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  it('webSocketMessage ignores non-string messages', async () => {
    const state = createMockState();
    const room = new MirrorRoom(state);
    const ws = {} as WebSocket;
    // Should not throw
    await room.webSocketMessage(ws, new ArrayBuffer(8));
  });

  it('webSocketMessage ignores malformed JSON', async () => {
    const state = createMockState();
    const room = new MirrorRoom(state);
    const ws = {} as WebSocket;
    // Should not throw
    await room.webSocketMessage(ws, 'not-json{{{');
  });

  it('webSocketMessage ignores unknown ws (no session)', async () => {
    const state = createMockState();
    const room = new MirrorRoom(state);
    const ws = {} as WebSocket;
    // Should not throw — unknown ws has no session
    await room.webSocketMessage(ws, JSON.stringify({ type: 'result', data: { text: 'hello' } }));
  });

  it('webSocketClose with unknown ws does not throw', async () => {
    const state = createMockState();
    const room = new MirrorRoom(state);
    // Should not throw
    await room.webSocketClose({} as WebSocket);
  });

  it('webSocketError with unknown ws does not throw', async () => {
    const state = createMockState();
    const room = new MirrorRoom(state);
    // Should not throw
    await room.webSocketError({} as WebSocket);
  });
});
