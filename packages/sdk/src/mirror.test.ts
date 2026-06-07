import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMirror, generateRoomId, joinMirror } from './mirror';

// Mock WebSocket for Node environment
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    // Simulate async open
    setTimeout(() => this.onopen?.(), 0);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
}

beforeEach(() => {
  (globalThis as Record<string, unknown>).WebSocket = MockWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).WebSocket;
});

describe('generateRoomId', () => {
  it('returns 8 characters', () => {
    expect(generateRoomId()).toHaveLength(8);
  });

  it('uses only allowed characters', () => {
    const allowed = 'abcdefghjkmnpqrstuvwxyz23456789';
    for (let i = 0; i < 20; i++) {
      const id = generateRoomId();
      for (const ch of id) {
        expect(allowed).toContain(ch);
      }
    }
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateRoomId()));
    expect(ids.size).toBe(50);
  });

  it('excludes ambiguous characters (0, 1, i, l, o)', () => {
    // Run many times to statistically verify
    for (let i = 0; i < 100; i++) {
      const id = generateRoomId();
      expect(id).not.toMatch(/[01ilo]/);
    }
  });
});

describe('createMirror', () => {
  it('creates instance with roomId', () => {
    const mirror = createMirror({ agentId: 'test-agent', apiBase: 'https://example.com' });
    expect(mirror.roomId).toHaveLength(8);
    mirror.destroy();
  });

  it('generates correct mobile URL', () => {
    const mirror = createMirror({ agentId: 'my-agent', apiBase: 'https://example.com' });
    const url = mirror.getMobileUrl();
    expect(url).toContain('https://example.com/mirror/');
    expect(url).toContain(`room=${mirror.roomId}`);
    expect(url).toContain('agent=my-agent');
    mirror.destroy();
  });

  it('generates correct QR URL', () => {
    const mirror = createMirror({ agentId: 'my-agent', apiBase: 'https://example.com' });
    expect(mirror.getQRUrl()).toBe(mirror.getMobileUrl());
    mirror.destroy();
  });

  it('URL-encodes agent ID', () => {
    const mirror = createMirror({ agentId: 'agent with spaces', apiBase: 'https://example.com' });
    expect(mirror.getMobileUrl()).toContain('agent=agent%20with%20spaces');
    mirror.destroy();
  });

  it('strips trailing slash from apiBase', () => {
    const mirror = createMirror({ agentId: 'test', apiBase: 'https://example.com/' });
    expect(mirror.getMobileUrl()).toContain('https://example.com/mirror/');
    expect(mirror.getMobileUrl()).not.toContain('//mirror/');
    mirror.destroy();
  });

  it('starts with peerCount 0', () => {
    const mirror = createMirror({ agentId: 'test', apiBase: 'https://example.com' });
    expect(mirror.peerCount).toBe(0);
    expect(mirror.isConnected()).toBe(false);
    mirror.destroy();
  });

  it('send does not throw after destroy', () => {
    const mirror = createMirror({ agentId: 'test', apiBase: 'https://example.com' });
    mirror.destroy();
    // Should not throw
    mirror.send({ type: 'result', data: 'test', from: 'desktop' });
    mirror.sendResult('test');
    mirror.sendStatus('test');
  });

  it('destroy can be called multiple times', () => {
    const mirror = createMirror({ agentId: 'test', apiBase: 'https://example.com' });
    mirror.destroy();
    mirror.destroy();
    // No error
  });
});

describe('joinMirror', () => {
  it('creates mobile instance', () => {
    const inst = joinMirror({
      roomId: 'abcd1234',
      agentId: 'test',
      apiBase: 'https://example.com',
    });
    expect(inst).toBeDefined();
    expect(inst.send).toBeInstanceOf(Function);
    expect(inst.sendInput).toBeInstanceOf(Function);
    inst.destroy();
  });

  it('send does not throw after destroy', () => {
    const inst = joinMirror({
      roomId: 'abcd1234',
      agentId: 'test',
      apiBase: 'https://example.com',
    });
    inst.destroy();
    inst.send({ type: 'input', data: 'test', from: 'mobile' });
    inst.sendInput('test');
  });

  it('destroy can be called multiple times', () => {
    const inst = joinMirror({
      roomId: 'abcd1234',
      agentId: 'test',
      apiBase: 'https://example.com',
    });
    inst.destroy();
    inst.destroy();
  });
});
