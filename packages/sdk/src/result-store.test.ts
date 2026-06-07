import { describe, expect, it, vi } from 'vitest';
import { ResultStore } from './result-store.js';

// Mock IndexedDB
const mockStore: Record<string, any> = {};
const mockObjectStore = {
  put: vi.fn((item: any) => {
    mockStore[item.id] = item;
    return { onsuccess: null, onerror: null };
  }),
  get: vi.fn((id: string) => {
    const req = {
      result: mockStore[id] ?? undefined,
      onsuccess: null as any,
      onerror: null as any,
    };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }),
  getAll: vi.fn(() => {
    const req = { result: Object.values(mockStore), onsuccess: null as any, onerror: null as any };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }),
  delete: vi.fn((id: string) => {
    delete mockStore[id];
    return { onsuccess: null, onerror: null };
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(mockStore)) delete mockStore[k];
    return { onsuccess: null, onerror: null };
  }),
};

const mockTransaction = {
  objectStore: vi.fn().mockReturnValue(mockObjectStore),
  oncomplete: null as any,
  onerror: null as any,
};

const mockDb = {
  transaction: vi.fn(() => {
    setTimeout(() => mockTransaction.oncomplete?.(), 0);
    return mockTransaction;
  }),
  objectStoreNames: { contains: vi.fn().mockReturnValue(true) },
};

vi.stubGlobal('indexedDB', {
  open: vi.fn(() => {
    const req = {
      result: mockDb,
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
    };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }),
});

describe('ResultStore', () => {
  it('constructor creates store with agentId namespace', () => {
    const _store = new ResultStore('test-agent');
    expect(indexedDB.open).toHaveBeenCalledWith('fags-results-test-agent', 1);
  });
});
