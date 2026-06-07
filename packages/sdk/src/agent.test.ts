import { describe, expect, it, vi } from 'vitest';
import { initAgent } from './agent.js';

// Stub browser APIs needed by sub-modules
vi.stubGlobal('caches', {
  open: vi
    .fn()
    .mockResolvedValue({ match: vi.fn(), put: vi.fn(), keys: vi.fn().mockResolvedValue([]) }),
});
vi.stubGlobal('navigator', { storage: { estimate: vi.fn().mockResolvedValue({ usage: 0 }) } });
vi.stubGlobal('indexedDB', {
  open: vi.fn(() => {
    const req = {
      result: { transaction: vi.fn(), objectStoreNames: { contains: () => true } },
      onsuccess: null as any,
      onerror: null,
      onupgradeneeded: null,
    };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }),
});

describe('initAgent', () => {
  it('returns agent with all sub-clients', () => {
    const agent = initAgent({ agentId: 'test-agent' });
    expect(agent.agentId).toBe('test-agent');
    expect(agent.auth).toBeDefined();
    expect(agent.kv).toBeDefined();
    expect(agent.rooms).toBeDefined();
    expect(agent.models).toBeDefined();
    expect(agent.ollama).toBeDefined();
    expect(agent.results).toBeDefined();
    expect(agent.cache).toBeDefined();
  });

  it('uses default API base', () => {
    const agent = initAgent({ agentId: 'test' });
    expect(agent.agentId).toBe('test');
  });

  it('accepts custom API base', () => {
    const agent = initAgent({ agentId: 'test', apiBase: 'https://custom.api.com' });
    expect(agent.agentId).toBe('test');
  });
});
