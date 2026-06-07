import { describe, expect, it, vi } from 'vitest';
import { Auth } from './auth.js';

describe('Auth', () => {
  it('starts with null user', () => {
    const auth = new Auth('https://api.test.com', 'test-agent');
    expect(auth.user).toBeNull();
  });

  it('me() returns null on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const auth = new Auth('https://api.test.com', 'test-agent');
    expect(await auth.me()).toBeNull();
  });

  it('me() returns null on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const auth = new Auth('https://api.test.com', 'test-agent');
    expect(await auth.me()).toBeNull();
  });

  it('me() returns user on success', async () => {
    const user = { id: '123', name: 'Test', avatar: 'https://avatar.url' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user }),
      }),
    );
    const auth = new Auth('https://api.test.com', 'test-agent');
    const result = await auth.me();
    expect(result).toEqual(user);
    expect(auth.user).toEqual(user);
  });

  it('onAuthChange fires when user changes', async () => {
    const user = { id: '123', name: 'Test', avatar: '' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user }),
      }),
    );
    const auth = new Auth('https://api.test.com', 'test-agent');
    const fn = vi.fn();
    auth.onAuthChange(fn);
    await auth.me();
    expect(fn).toHaveBeenCalledWith(user);
  });

  it('onAuthChange returns unsubscribe function', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: { id: '1', name: 'T', avatar: '' } }),
      }),
    );
    const auth = new Auth('https://api.test.com', 'test-agent');
    const fn = vi.fn();
    const unsub = auth.onAuthChange(fn);
    unsub();
    await auth.me();
    expect(fn).not.toHaveBeenCalled();
  });

  it('signOut clears user', async () => {
    const user = { id: '1', name: 'T', avatar: '' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user }),
      }),
    );
    const auth = new Auth('https://api.test.com', 'test-agent');
    await auth.me(); // sets user
    expect(auth.user).toEqual(user);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    await auth.signOut();
    expect(auth.user).toBeNull();
  });
});
