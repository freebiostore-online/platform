import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Kv } from './kv.js';

describe('Kv', () => {
  let kv: Kv;

  beforeEach(() => {
    kv = new Kv('https://api.test.com', 'test-agent');
    vi.restoreAllMocks();
  });

  it('get() fetches value by key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ value: { hello: 'world' } }),
      }),
    );
    const val = await kv.get('my-key');
    expect(val).toEqual({ hello: 'world' });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/kv?app=test-agent&key=my-key',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('get() returns null on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await kv.get('bad-key')).toBeNull();
  });

  it('set() posts value', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    await kv.set('key', { data: 123 });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/kv',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ app: 'test-agent', key: 'key', value: { data: 123 } }),
      }),
    );
  });

  it('delete() sends DELETE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    await kv.delete('key');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/kv',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('list() returns keys array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ keys: ['a', 'b', 'c'] }),
      }),
    );
    const keys = await kv.list();
    expect(keys).toEqual(['a', 'b', 'c']);
  });

  it('list() returns empty array on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await kv.list()).toEqual([]);
  });
});
