import { describe, expect, it } from 'vitest';
import { handleApiRoute } from './api';
import type { Env } from './index';

function mockEnv(overrides?: Partial<Env>): Env {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ meta: { changes: 1 } }),
        }),
      }),
    } as unknown as D1Database,
    AGENTS: {} as unknown as R2Bucket,
    MIRROR_ROOMS: {} as unknown as DurableObjectNamespace,
    KEY_ENCRYPTION_KEY: 'dGVzdGtleTMyYnl0ZXMxMjM0NTY3ODkw', // valid base64, 24 bytes decoded — will fail length check
    SESSION_SIGNING_KEY: 'test-signing-key-for-hmac',
    ...overrides,
  };
}

function makeRequest(
  method: string,
  path: string,
  opts?: { headers?: Record<string, string>; body?: string },
): Request {
  return new Request(`https://freebiostore.online${path}`, {
    method,
    headers: opts?.headers ?? {},
    body: opts?.body,
  });
}

// Helper: create a valid session token for testing
async function createTestToken(uid: string, signingKey: string): Promise<string> {
  const payload = {
    uid,
    login: 'test-user',
    avatar: '',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const payloadB64 = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64)),
  );
  const sigHex = Array.from(sig)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${payloadB64}.${sigHex}`;
}

describe('handleApiRoute', () => {
  // ── Providers ──
  it('GET /v1/keys/providers returns 6 providers', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys/providers'),
      new URL('https://freebiostore.online/v1/keys/providers'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { providers: { id: string }[] };
    expect(body.providers.length).toBe(6);
    expect(body.providers.map((p) => p.id)).toContain('openai');
    expect(body.providers.map((p) => p.id)).toContain('anthropic');
    expect(body.providers.map((p) => p.id)).toContain('google');
    expect(body.providers.map((p) => p.id)).toContain('groq');
  });

  // ── Auth required routes ──
  it('GET /v1/keys/status without auth returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys/status'),
      new URL('https://freebiostore.online/v1/keys/status'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  it('PUT /v1/keys/openai without auth returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('PUT', '/v1/keys/openai', {
        body: JSON.stringify({ key: 'sk-test' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      new URL('https://freebiostore.online/v1/keys/openai'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  it('DELETE /v1/keys/openai without auth returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('DELETE', '/v1/keys/openai'),
      new URL('https://freebiostore.online/v1/keys/openai'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  // ── Auth with valid token ──
  it('GET /v1/keys/status with valid token returns keys array', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys/status', { headers: { Authorization: `Bearer ${token}` } }),
      new URL('https://freebiostore.online/v1/keys/status'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { keys: unknown[] };
    expect(body.keys).toBeInstanceOf(Array);
  });

  it('GET /v1/auth/me with valid token returns user info', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
      new URL('https://freebiostore.online/v1/auth/me'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { uid: string; login: string };
    expect(body.uid).toBe('user-123');
    expect(body.login).toBe('test-user');
  });

  it('GET /v1/auth/me without auth returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/me'),
      new URL('https://freebiostore.online/v1/auth/me'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  // ── CORS ──
  it('OPTIONS returns 204 with CORS headers', async () => {
    const res = await handleApiRoute(
      makeRequest('OPTIONS', '/v1/keys/providers'),
      new URL('https://freebiostore.online/v1/keys/providers'),
      mockEnv(),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
  });

  it('all JSON responses include CORS headers', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys/providers'),
      new URL('https://freebiostore.online/v1/keys/providers'),
      mockEnv(),
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  // ── Routing ──
  it('unknown /v1/ route returns 404', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/nonexistent'),
      new URL('https://freebiostore.online/v1/nonexistent'),
      mockEnv(),
    );
    expect(res.status).toBe(404);
  });

  // ── OAuth ──
  it('GET /v1/auth/github redirects to GitHub OAuth', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/github'),
      new URL('https://freebiostore.online/v1/auth/github'),
      mockEnv({ GITHUB_CLIENT_ID: 'test-client-id' } as unknown as Env),
    );
    expect(res.status).toBe(302);
    const location = res.headers.get('Location') ?? '';
    expect(location).toContain('github.com/login/oauth/authorize');
    expect(location).toContain('client_id=test-client-id');
  });

  it('GET /v1/auth/github without client ID returns 503', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/github'),
      new URL('https://freebiostore.online/v1/auth/github'),
      mockEnv({ GITHUB_CLIENT_ID: undefined } as unknown as Env),
    );
    expect(res.status).toBe(503);
  });

  // ── Logout ──
  it('POST /v1/auth/logout clears session cookie', async () => {
    const res = await handleApiRoute(
      makeRequest('POST', '/v1/auth/logout'),
      new URL('https://freebiostore.online/v1/auth/logout'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('fags_session=');
    expect(cookie).toContain('Max-Age=0');
  });

  // ── Usage ──
  it('GET /v1/usage without auth returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/usage'),
      new URL('https://freebiostore.online/v1/usage'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  // ── Key management page ──
  it('GET /v1/keys redirects to console', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys'),
      new URL('https://freebiostore.online/v1/keys'),
      mockEnv(),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/console/#keys');
  });

  // ── Expired token ──
  it('expired token returns 401', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const payload = {
      uid: 'user-123',
      login: 'test-user',
      avatar: '',
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
    };
    const payloadB64 = btoa(JSON.stringify(payload));
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(signingKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64)),
    );
    const sigHex = Array.from(sig)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const token = `${payloadB64}.${sigHex}`;

    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
      new URL('https://freebiostore.online/v1/auth/me'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(401);
  });

  // ── Invalid token ──
  it('tampered token returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/me', {
        headers: { Authorization: 'Bearer dGVzdA==.0000000000' },
      }),
      new URL('https://freebiostore.online/v1/auth/me'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  it('malformed token (no dot) returns 401', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/me', {
        headers: { Authorization: 'Bearer nodottoken' },
      }),
      new URL('https://freebiostore.online/v1/auth/me'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  // ── Cookie auth ──
  it('auth via cookie works', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-456', signingKey);
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/me', { headers: { Cookie: `fags_session=${token}` } }),
      new URL('https://freebiostore.online/v1/auth/me'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { uid: string };
    expect(body.uid).toBe('user-456');
  });

  // ── PUT /v1/keys/:provider validation ──
  it('PUT /v1/keys/unknown-provider returns 400', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('PUT', '/v1/keys/nonexistent', {
        body: JSON.stringify({ key: 'test-key' }),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }),
      new URL('https://freebiostore.online/v1/keys/nonexistent'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Unknown provider');
  });

  it('PUT /v1/keys/openai with wrong prefix returns 400', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('PUT', '/v1/keys/openai', {
        body: JSON.stringify({ key: 'wrong-prefix-key' }),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }),
      new URL('https://freebiostore.online/v1/keys/openai'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('sk-');
  });

  it('PUT /v1/keys/openai with empty key returns 400', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('PUT', '/v1/keys/openai', {
        body: JSON.stringify({ key: '' }),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }),
      new URL('https://freebiostore.online/v1/keys/openai'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(400);
  });

  it('PUT /v1/keys/openai with no body returns 400', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('PUT', '/v1/keys/openai', {
        body: 'not json',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }),
      new URL('https://freebiostore.online/v1/keys/openai'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(400);
  });

  // ── QR endpoint ──
  it('GET /v1/qr without data param returns 400', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/qr'),
      new URL('https://freebiostore.online/v1/qr'),
      mockEnv(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('data');
  });

  it('GET /v1/qr with data returns SVG', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/qr'),
      new URL('https://freebiostore.online/v1/qr?data=https://example.com'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    const svg = await res.text();
    expect(svg).toContain('<svg');
  });

  // ── Mirror.js ──
  it('GET /v1/mirror.js returns JavaScript', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/mirror.js'),
      new URL('https://freebiostore.online/v1/mirror.js'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/javascript');
    const js = await res.text();
    expect(js).toContain('FagsMirrorElement');
  });

  // ── Mirror room info ──
  it('GET /v1/mirror/:roomId returns room info', async () => {
    const mockRoomFetch = async () =>
      new Response(JSON.stringify({ peers: 0, devices: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    const mirrorRooms = {
      idFromName: () => ({ toString: () => 'test-id' }),
      get: () => ({ fetch: mockRoomFetch }),
    } as unknown as DurableObjectNamespace;

    const res = await handleApiRoute(
      makeRequest('GET', '/v1/mirror/abcdef12'),
      new URL('https://freebiostore.online/v1/mirror/abcdef12'),
      mockEnv({ MIRROR_ROOMS: mirrorRooms }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { peers: number };
    expect(body.peers).toBe(0);
  });

  // ── OAuth state cookie ──
  it('GET /v1/auth/github sets state cookie', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/github'),
      new URL('https://freebiostore.online/v1/auth/github'),
      mockEnv({ GITHUB_CLIENT_ID: 'test-id' } as unknown as Env),
    );
    expect(res.status).toBe(302);
    // Set-Cookie contains the state cookie — verify via raw header
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('fags_oauth_state=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
  });

  // ── OAuth return_to param ──
  it('GET /v1/auth/github with return_to sets cookie', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/auth/github'),
      new URL('https://freebiostore.online/v1/auth/github?return_to=/console/'),
      mockEnv({ GITHUB_CLIENT_ID: 'test-id' } as unknown as Env),
    );
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('fags_return_to=');
    expect(setCookie).toContain('%2Fconsole%2F');
  });

  // ── Providers list content ──
  it('providers include all 6 with required fields', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys/providers'),
      new URL('https://freebiostore.online/v1/keys/providers'),
      mockEnv(),
    );
    const body = (await res.json()) as {
      providers: { id: string; name: string; host: string; docsUrl: string }[];
    };
    expect(body.providers).toHaveLength(6);
    for (const p of body.providers) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.host).toBeTruthy();
      expect(p.docsUrl).toMatch(/^https:\/\//);
    }
    const ids = body.providers.map((p) => p.id);
    expect(ids).toContain('openrouter');
    expect(ids).toContain('together');
  });

  // ── Health check ──
  it('GET /v1/health returns healthy status', async () => {
    const env = mockEnv({
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ '1': 1 }),
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 0 } }),
          }),
          first: async () => ({ '1': 1 }),
        }),
      } as unknown as D1Database,
    });
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/health'),
      new URL('https://freebiostore.online/v1/health'),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; db: string; timestamp: string };
    expect(body.status).toBe('healthy');
    expect(body.db).toBe('ok');
    expect(body.timestamp).toBeTruthy();
  });

  it('GET /v1/health returns degraded when DB fails', async () => {
    const env = mockEnv({
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => {
              throw new Error('DB down');
            },
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 0 } }),
          }),
          first: async () => {
            throw new Error('DB down');
          },
        }),
      } as unknown as D1Database,
    });
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/health'),
      new URL('https://freebiostore.online/v1/health'),
      env,
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; db: string };
    expect(body.status).toBe('degraded');
    expect(body.db).toBe('error');
  });

  // ── Error response includes requestId ──
  it('500 errors include requestId', async () => {
    const env = mockEnv({
      DB: {
        prepare: () => {
          throw new Error('Simulated DB crash');
        },
      } as unknown as D1Database,
    });
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/keys/status', { headers: { Authorization: `Bearer ${token}` } }),
      new URL('https://freebiostore.online/v1/keys/status'),
      env,
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; requestId: string };
    expect(body.requestId).toBeTruthy();
    expect(body.requestId).toHaveLength(8);
    // Should NOT leak internal error details
    expect(body.error).toBe('Internal error');
  });

  // ── Proxy auth ──
  it('proxy without auth returns 401 (not 500)', async () => {
    const res = await handleApiRoute(
      makeRequest('POST', '/v1/proxy/api.openai.com/v1/chat/completions', {
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [] }),
        headers: { 'Content-Type': 'application/json' },
      }),
      new URL('https://freebiostore.online/v1/proxy/api.openai.com/v1/chat/completions'),
      mockEnv(),
    );
    expect(res.status).toBe(401);
  });

  it('proxy with unknown host returns 400', async () => {
    const signingKey = 'test-signing-key-for-hmac';
    const token = await createTestToken('user-123', signingKey);
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/proxy/unknown.api.com/v1/test', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      new URL('https://freebiostore.online/v1/proxy/unknown.api.com/v1/test'),
      mockEnv({ SESSION_SIGNING_KEY: signingKey }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Unknown proxy host');
  });

  // ── Stats endpoint ──
  it('GET /v1/stats/:agentId returns usage counts', async () => {
    const env = mockEnv({
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ calls: 42, last_used: 1700000000 }),
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 0 } }),
          }),
        }),
      } as unknown as D1Database,
    });
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/stats/sentiment'),
      new URL('https://freebiostore.online/v1/stats/sentiment'),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { calls: number; lastUsed: string | null };
    expect(body.calls).toBe(42);
    expect(body.lastUsed).toBeTruthy();
    expect(res.headers.get('Cache-Control')).toContain('max-age=300');
  });

  it('GET /v1/stats/:agentId returns zero for unused agent', async () => {
    const res = await handleApiRoute(
      makeRequest('GET', '/v1/stats/nonexistent'),
      new URL('https://freebiostore.online/v1/stats/nonexistent'),
      mockEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { calls: number; lastUsed: string | null };
    expect(body.calls).toBe(0);
    expect(body.lastUsed).toBeNull();
  });
});
