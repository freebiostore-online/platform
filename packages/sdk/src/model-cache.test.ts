import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelCache } from './model-cache.js';

// Mock Cache Storage API
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  keys: vi.fn(),
  delete: vi.fn(),
};

vi.stubGlobal('caches', {
  open: vi.fn().mockResolvedValue(mockCache),
  delete: vi.fn().mockResolvedValue(true),
});

vi.stubGlobal('navigator', {
  storage: { estimate: vi.fn().mockResolvedValue({ usage: 200_000_000 }) },
});

describe('ModelCache', () => {
  let cache: ModelCache;

  beforeEach(() => {
    cache = new ModelCache();
    vi.clearAllMocks();
  });

  it('has() returns true when model is cached', async () => {
    mockCache.match.mockResolvedValue(new Response('data'));
    expect(await cache.has('https://hf.co/model.onnx')).toBe(true);
  });

  it('has() returns false when model is not cached', async () => {
    mockCache.match.mockResolvedValue(undefined);
    expect(await cache.has('https://hf.co/model.onnx')).toBe(false);
  });

  it('get() returns cached response', async () => {
    const resp = new Response('model data');
    mockCache.match.mockResolvedValue(resp);
    const result = await cache.get('https://hf.co/model.onnx');
    expect(result).toBe(resp);
  });

  it('get() returns null for uncached', async () => {
    mockCache.match.mockResolvedValue(undefined);
    expect(await cache.get('https://hf.co/model.onnx')).toBeNull();
  });

  it('put() stores a response clone', async () => {
    const resp = new Response('data');
    await cache.put('https://hf.co/model.onnx', resp);
    expect(mockCache.put).toHaveBeenCalledOnce();
    expect(mockCache.put.mock.calls[0][0]).toBe('https://hf.co/model.onnx');
  });

  it('keys() returns cached URLs', async () => {
    mockCache.keys.mockResolvedValue([
      new Request('https://hf.co/whisper.onnx'),
      new Request('https://hf.co/kokoro.onnx'),
    ]);
    const keys = await cache.keys();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toContain('whisper');
  });

  it('size() returns estimated storage usage', async () => {
    const size = await cache.size();
    expect(size).toBe(200_000_000);
  });

  it('clear() deletes the cache', async () => {
    await cache.clear();
    expect(caches.delete).toHaveBeenCalledWith('fags-models');
  });

  it('remove() deletes a specific model', async () => {
    mockCache.delete.mockResolvedValue(true);
    const removed = await cache.remove('https://hf.co/model.onnx');
    expect(removed).toBe(true);
  });
});
