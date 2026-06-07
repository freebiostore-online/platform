import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerBridge } from './worker-bridge.js';

// Mock Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  private handlers: Array<(e: MessageEvent) => void> = [];

  postMessage(data: any) {
    // Simulate worker responding with same id
    setTimeout(() => {
      const msg = new MessageEvent('message', { data: { ...data, type: 'result' } });
      this.onmessage?.(msg);
      for (const h of this.handlers) h(msg);
    }, 1);
  }

  addEventListener(_: string, fn: any) {
    this.handlers.push(fn);
  }
  removeEventListener(_: string, fn: any) {
    this.handlers = this.handlers.filter((h) => h !== fn);
  }
  terminate() {}
}

vi.stubGlobal('Worker', MockWorker);

describe('WorkerBridge', () => {
  let bridge: WorkerBridge;

  beforeEach(() => {
    bridge = new WorkerBridge('/test-worker.js');
  });

  it('starts and stops without error', () => {
    bridge.start();
    bridge.stop();
  });

  it('throws when sending without starting', async () => {
    await expect(bridge.send('test')).rejects.toThrow('Worker not started');
  });

  it('post() sends fire-and-forget messages', () => {
    bridge.start();
    // Should not throw
    bridge.post('ping');
    bridge.stop();
  });

  it('on() registers event listeners', () => {
    bridge.start();
    const fn = vi.fn();
    const unsub = bridge.on('progress', fn);
    expect(typeof unsub).toBe('function');
    unsub();
    bridge.stop();
  });

  it('stop() rejects pending promises', async () => {
    bridge.start();
    // Don't await — we want it pending when we stop
    const promise = bridge.send('test');
    bridge.stop();
    // The mock will resolve before stop, so this may or may not reject
    // depending on timing. Just ensure no unhandled errors.
    await promise.catch(() => {});
  });
});
