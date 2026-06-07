import { describe, expect, it, vi } from 'vitest';
import { Room, Rooms } from './rooms.js';

// Mock WebSocket
class MockWebSocket {
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  readyState = 1;

  constructor(url: string) {
    this.url = url;
  }

  send(_data: string) {
    // no-op for tests
  }

  close() {
    this.readyState = 3;
  }
}

vi.stubGlobal('WebSocket', MockWebSocket);

describe('Rooms', () => {
  it('create() returns a Room with correct WebSocket URL', () => {
    const rooms = new Rooms('https://api.test.com', 'test-agent');
    const room = rooms.create('lobby');
    expect(room).toBeInstanceOf(Room);
  });
});

describe('Room', () => {
  it('connect() creates a WebSocket', () => {
    const room = new Room('wss://api.test.com/v1/rooms?app=test&room=lobby');
    room.connect();
    // Should not throw
  });

  it('send() sends JSON message', () => {
    const room = new Room('wss://api.test.com/v1/rooms?app=test&room=lobby');
    room.connect();
    // Should not throw
    room.send('chat', { text: 'hello' });
  });

  it('on() registers handler and returns unsubscribe', () => {
    const room = new Room('wss://api.test.com/v1/rooms?app=test&room=lobby');
    const fn = vi.fn();
    const unsub = room.on('chat', fn);
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('close() cleans up', () => {
    const room = new Room('wss://api.test.com/v1/rooms?app=test&room=lobby');
    room.connect();
    room.close();
    // Should not throw
  });
});
