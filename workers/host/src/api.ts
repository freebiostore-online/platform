/**
 * FAGS Host Worker — API routes for auth, user key vault + proxy.
 *
 * Routes:
 *   GET    /v1/auth/github       → start GitHub OAuth login
 *   GET    /v1/auth/callback     → handle GitHub OAuth callback
 *   GET    /v1/auth/me           → get current user (auth)
 *   POST   /v1/auth/logout       → clear session
 *   GET    /v1/keys/providers    → list supported AI providers (public)
 *   GET    /v1/keys/status       → which providers the user has keys for (auth)
 *   PUT    /v1/keys/:provider    → store/update an encrypted key (auth)
 *   DELETE /v1/keys/:provider    → remove a key (auth)
 *   GET    /v1/keys              → server-rendered HTML key management page (auth)
 *   GET    /v1/usage             → usage stats (auth)
 *   ALL    /v1/proxy/:host/*     → proxy request with injected user key (auth)
 *   GET    /v1/stats/:agentId    → public aggregate usage stats for an agent
 *   GET    /v1/mirror.js         → mirror Web Component client script
 *   GET    /v1/mirror/:roomId/ws → WebSocket upgrade → MirrorRoom DO
 *   GET    /v1/mirror/:roomId    → room info (peer count)
 *   POST   /v1/mirror/:roomId    → fallback relay via DO broadcast
 */

import type { Env } from './index';

// ── Providers ────────────────────────────────────────────────────────────────

interface Provider {
  id: string;
  name: string;
  host: string;
  keyPrefix: string;
  docsUrl: string;
}

const PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    host: 'api.openai.com',
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    host: 'api.anthropic.com',
    keyPrefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'google',
    name: 'Google AI (Gemini)',
    host: 'generativelanguage.googleapis.com',
    keyPrefix: 'AI',
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    host: 'openrouter.ai',
    keyPrefix: 'sk-or-',
    docsUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'groq',
    name: 'Groq',
    host: 'api.groq.com',
    keyPrefix: 'gsk_',
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'together',
    name: 'Together AI',
    host: 'api.together.xyz',
    keyPrefix: '',
    docsUrl: 'https://api.together.xyz/settings/api-keys',
  },
];

const HOST_TO_PROVIDER: Record<string, string> = {};
for (const p of PROVIDERS) HOST_TO_PROVIDER[p.host] = p.id;

const PROVIDER_BY_ID: Record<string, Provider> = {};
for (const p of PROVIDERS) PROVIDER_BY_ID[p.id] = p;

// ── IP rate limiting (auth endpoints, in-memory per isolate) ─────────────────

const AUTH_RATE_WINDOW = 60_000; // 1 minute
const AUTH_RATE_MAX = 20; // max 20 auth requests per IP per minute
const ipCounts = new Map<string, { count: number; resetAt: number }>();

function checkIpRateLimit(request: Request): boolean {
  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown';
  const now = Date.now();
  const entry = ipCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + AUTH_RATE_WINDOW });
    return true;
  }

  entry.count++;
  if (entry.count > AUTH_RATE_MAX) return false;
  return true;
}

// Periodic cleanup to prevent memory leak (runs at most once per minute)
let lastCleanup = 0;
function cleanupIpCounts(): void {
  const now = Date.now();
  if (now - lastCleanup < AUTH_RATE_WINDOW) return;
  lastCleanup = now;
  for (const [ip, entry] of ipCounts) {
    if (now > entry.resetAt) ipCounts.delete(ip);
  }
}

// ── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function corsHeaders(): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(CORS_HEADERS)) h.set(k, v);
  return h;
}

function jsonResponse(data: unknown, status = 200): Response {
  const h = corsHeaders();
  h.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers: h });
}

// ── Auth ─────────────────────────────────────────────────────────────────────

interface SessionPayload {
  uid: string;
  login?: string;
  avatar?: string;
  exp: number;
}

async function verifySession(request: Request, env: Env): Promise<string | null> {
  // Extract token from Authorization header or session cookie
  let token: string | null = null;
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  if (!token) {
    const cookie = request.headers.get('Cookie') ?? '';
    const match = cookie.match(/(?:^|;\s*)fags_session=([^\s;]+)/);
    if (match) token = match[1];
  }
  if (!token || !env.SESSION_SIGNING_KEY) return null;

  // Token format: base64(payload).signature
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex < 0) return null;

  const payloadB64 = token.slice(0, dotIndex);
  const signatureHex = token.slice(dotIndex + 1);

  // Verify HMAC-SHA256 signature
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.SESSION_SIGNING_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const signatureBytes = hexToBuffer(signatureHex);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    new TextEncoder().encode(payloadB64),
  );
  if (!valid) return null;

  // Decode payload
  try {
    const payload: SessionPayload = JSON.parse(atob(payloadB64));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload.uid ?? null;
  } catch {
    return null;
  }
}

async function requireAuth(request: Request, env: Env): Promise<string> {
  const uid = await verifySession(request, env);
  if (!uid) throw new AuthError();
  return uid;
}

class AuthError extends Error {
  constructor() {
    super('Unauthorized');
  }
}

async function verifySessionFull(request: Request, env: Env): Promise<SessionPayload | null> {
  let token: string | null = null;
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  if (!token) {
    const cookie = request.headers.get('Cookie') ?? '';
    const match = cookie.match(/(?:^|;\s*)fags_session=([^\s;]+)/);
    if (match) token = match[1];
  }
  if (!token || !env.SESSION_SIGNING_KEY) return null;

  const dotIndex = token.lastIndexOf('.');
  if (dotIndex < 0) return null;

  const payloadB64 = token.slice(0, dotIndex);
  const signatureHex = token.slice(dotIndex + 1);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.SESSION_SIGNING_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const signatureBytes = hexToBuffer(signatureHex);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    new TextEncoder().encode(payloadB64),
  );
  if (!valid) return null;

  try {
    const payload: SessionPayload = JSON.parse(atob(payloadB64));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

async function createSession(
  uid: string,
  login: string,
  avatar: string,
  signingKey: string,
): Promise<string> {
  const payload: SessionPayload = {
    uid,
    login,
    avatar,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
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

// ── Encryption (envelope: DEK wrapped under KEK, same pattern as FAS) ────────

interface SealedKey {
  keyCiphertext: Uint8Array;
  dekWrapped: Uint8Array;
  iv: Uint8Array;
}

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const KEK_IV_LENGTH = 12;

async function importKek(kekBase64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(kekBase64);
  if (raw.byteLength !== KEY_LENGTH) {
    throw new Error(
      `KEY_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes base64-encoded (got ${raw.byteLength})`,
    );
  }
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function sealKey(plaintext: string, kekBase64: string): Promise<SealedKey> {
  const kek = await importKek(kekBase64);

  const dekRaw = crypto.getRandomValues(new Uint8Array(KEY_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const dek = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, false, ['encrypt']);

  const keyCiphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, new TextEncoder().encode(plaintext)),
  );

  const ivKek = crypto.getRandomValues(new Uint8Array(KEK_IV_LENGTH));
  const wrapped = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivKek }, kek, dekRaw),
  );
  const dekWrapped = new Uint8Array(KEK_IV_LENGTH + wrapped.byteLength);
  dekWrapped.set(ivKek, 0);
  dekWrapped.set(wrapped, KEK_IV_LENGTH);

  return { keyCiphertext, dekWrapped, iv };
}

async function openKey(sealed: SealedKey, kekBase64: string): Promise<string> {
  const kek = await importKek(kekBase64);

  const ivKek = sealed.dekWrapped.slice(0, KEK_IV_LENGTH);
  const wrappedBody = sealed.dekWrapped.slice(KEK_IV_LENGTH);
  const dekRaw = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivKek }, kek, wrappedBody),
  );

  const dek = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, false, ['decrypt']);

  const plaintextBytes = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, dek, sealed.keyCiphertext),
  );
  return new TextDecoder().decode(plaintextBytes);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toUint8(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (Array.isArray(v)) return Uint8Array.from(v as number[]);
  return new Uint8Array(0);
}

// ── Pricing table (per 1M tokens) ────────────────────────────────────────────

const PRICING: Record<string, Record<string, { input: number; output: number }>> = {
  openai: {
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
  },
  anthropic: {
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  },
  google: {
    'gemini-1.5-flash': { input: 0.075, output: 0.3 },
    'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  },
  groq: {
    'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
    'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },
  },
};

async function logUsage(
  db: D1Database,
  userId: string,
  provider: string,
  model: string | null,
  tokensIn: number,
  tokensOut: number,
  agentId: string | null,
): Promise<void> {
  const pricing = PRICING[provider]?.[model ?? ''];
  const costUsd = pricing
    ? (tokensIn * pricing.input) / 1_000_000 + (tokensOut * pricing.output) / 1_000_000
    : null;

  await db
    .prepare(
      'INSERT INTO usage_log (user_id, provider, model, tokens_in, tokens_out, cost_usd, agent_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())',
    )
    .bind(userId, provider, model, tokensIn, tokensOut, costUsd, agentId)
    .run();
}

// ── Rate limiting ────────────────────────────────────────────────────────────

const PROXY_RATE_LIMIT = 100; // requests per user per hour

async function checkRateLimit(db: D1Database, userId: string): Promise<boolean> {
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const row = await db
    .prepare('SELECT count FROM proxy_usage WHERE user_id = ? AND hour = ?')
    .bind(userId, hour)
    .first<{ count: number }>();

  if (row && row.count >= PROXY_RATE_LIMIT) return false;

  await db
    .prepare(
      `INSERT INTO proxy_usage (user_id, hour, count) VALUES (?, ?, 1)
       ON CONFLICT (user_id, hour) DO UPDATE SET count = count + 1`,
    )
    .bind(userId, hour)
    .run();

  return true;
}

// ── Headers to strip from proxy requests/responses ───────────────────────────

const PROXY_FORWARD_SKIP = new Set([
  'authorization',
  'cookie',
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
  'x-forwarded-for',
  'x-real-ip',
]);

const PROXY_RESPONSE_SKIP = new Set([
  'set-cookie',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
]);

// ── Router ───────────────────────────────────────────────────────────────────

export async function handleApiRoute(request: Request, url: URL, env: Env): Promise<Response> {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const path = url.pathname;

  // Periodic cleanup of IP rate limit map
  cleanupIpCounts();

  try {
    // ── Health check (public, no auth) ────────────────────────────────
    if (path === '/v1/health' && request.method === 'GET') {
      const dbOk = await env.DB.prepare('SELECT 1')
        .first()
        .then(
          () => true,
          () => false,
        );
      const status = dbOk ? 200 : 503;
      return jsonResponse(
        {
          status: dbOk ? 'healthy' : 'degraded',
          db: dbOk ? 'ok' : 'error',
          timestamp: new Date().toISOString(),
        },
        status,
      );
    }

    // ── Auth routes (IP rate-limited) ───────────────────────────────────
    if (path.startsWith('/v1/auth/') && !checkIpRateLimit(request)) {
      return jsonResponse({ error: 'Too many requests. Try again later.' }, 429);
    }

    // GET /v1/auth/github — Start GitHub OAuth
    if (path === '/v1/auth/github' && request.method === 'GET') {
      if (!env.GITHUB_CLIENT_ID) {
        return jsonResponse({ error: 'GitHub OAuth not configured.' }, 503);
      }
      const state = crypto.randomUUID();
      const redirectUri = `${url.origin}/v1/auth/callback`;
      const ghUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user&state=${state}`;
      const returnTo = url.searchParams.get('return_to') ?? '/';
      const h = new Headers({ Location: ghUrl });
      h.append(
        'Set-Cookie',
        `fags_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      );
      h.append(
        'Set-Cookie',
        `fags_return_to=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      );
      return new Response(null, { status: 302, headers: h });
    }

    // GET /v1/auth/callback — Handle GitHub callback
    if (path === '/v1/auth/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) {
        return new Response('Missing code or state', { status: 400 });
      }

      // Verify state matches cookie
      const cookies = request.headers.get('Cookie') ?? '';
      const stateMatch = cookies.match(/(?:^|;\s*)fags_oauth_state=([^\s;]+)/);
      if (!stateMatch || stateMatch[1] !== state) {
        return new Response('Invalid state (CSRF check failed)', { status: 403 });
      }

      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SIGNING_KEY) {
        return new Response('OAuth not configured', { status: 503 });
      }

      // Exchange code for access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const tokenData = await tokenRes.json<{ access_token?: string; error?: string }>();
      if (!tokenData.access_token) {
        return new Response(`GitHub token exchange failed: ${tokenData.error ?? 'unknown'}`, {
          status: 502,
        });
      }

      // Get user info
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'FreeBioStore-Host',
          Accept: 'application/json',
        },
      });
      if (!userRes.ok) {
        return new Response('Failed to fetch GitHub user info', { status: 502 });
      }
      const ghUser = await userRes.json<{
        id: number;
        login: string;
        name?: string;
        avatar_url?: string;
      }>();
      const uid = String(ghUser.id);

      // Upsert user in D1
      await env.DB.prepare(
        `INSERT INTO users (github_id, login, name, avatar_url, last_login_at)
           VALUES (?, ?, ?, ?, unixepoch())
           ON CONFLICT (github_id) DO UPDATE SET
             login = excluded.login,
             name = excluded.name,
             avatar_url = excluded.avatar_url,
             last_login_at = unixepoch()`,
      )
        .bind(uid, ghUser.login, ghUser.name ?? null, ghUser.avatar_url ?? null)
        .run();

      // Create session token
      const sessionToken = await createSession(
        uid,
        ghUser.login,
        ghUser.avatar_url ?? '',
        env.SESSION_SIGNING_KEY,
      );

      // Read return_to cookie for post-login redirect
      const returnMatch = cookies.match(/(?:^|;\s*)fags_return_to=([^\s;]+)/);
      const returnTo = returnMatch ? decodeURIComponent(returnMatch[1]) : '/';
      const safeReturn = returnTo.startsWith('/') ? returnTo : '/';

      // Set cookie + redirect with token in fragment for JS
      const h = new Headers({ Location: `${safeReturn}?login=success#session=${sessionToken}` });
      h.append(
        'Set-Cookie',
        `fags_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
      );
      // Clear the state + return_to cookies
      h.append(
        'Set-Cookie',
        'fags_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
      );
      h.append('Set-Cookie', 'fags_return_to=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      return new Response(null, { status: 302, headers: h });
    }

    // GET /v1/auth/me — Get current user (requires auth)
    if (path === '/v1/auth/me' && request.method === 'GET') {
      const session = await verifySessionFull(request, env);
      if (!session) return jsonResponse({ error: 'Unauthorized' }, 401);
      return jsonResponse({
        uid: session.uid,
        login: session.login ?? null,
        avatar: session.avatar ?? null,
      });
    }

    // POST /v1/auth/logout — Clear session
    if (path === '/v1/auth/logout' && request.method === 'POST') {
      const h = corsHeaders();
      h.set('Content-Type', 'application/json; charset=utf-8');
      h.append('Set-Cookie', 'fags_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      return new Response(JSON.stringify({ ok: true }), { headers: h });
    }

    // ── Key vault routes ──────────────────────────────────────────────

    // GET /v1/keys/providers (public)
    if (path === '/v1/keys/providers' && request.method === 'GET') {
      return jsonResponse({ providers: PROVIDERS });
    }

    // GET /v1/keys/status (auth)
    if (path === '/v1/keys/status' && request.method === 'GET') {
      const uid = await requireAuth(request, env);
      const rows = await env.DB.prepare(
        'SELECT provider, created_at FROM user_api_keys WHERE user_id = ?',
      )
        .bind(uid)
        .all<{ provider: string; created_at: number }>();
      return jsonResponse({
        keys: (rows.results ?? []).map((r) => ({
          provider: r.provider,
          createdAt: r.created_at,
        })),
      });
    }

    // PUT /v1/keys/:provider (auth)
    const putMatch = path.match(/^\/v1\/keys\/([a-z0-9-]+)$/);
    if (putMatch && request.method === 'PUT') {
      const uid = await requireAuth(request, env);
      if (!env.KEY_ENCRYPTION_KEY) {
        return jsonResponse({ ok: false, error: 'Key vault not configured.' }, 503);
      }

      const providerId = putMatch[1];
      const provider = PROVIDER_BY_ID[providerId];
      if (!provider) {
        return jsonResponse({ ok: false, error: `Unknown provider: ${providerId}` }, 400);
      }

      const body = await request.json<{ key?: string }>().catch(() => ({}) as { key?: string });
      if (!body.key || typeof body.key !== 'string' || body.key.length > 500) {
        return jsonResponse({ ok: false, error: 'Invalid key (max 500 chars).' }, 400);
      }

      if (provider.keyPrefix && !body.key.startsWith(provider.keyPrefix)) {
        return jsonResponse(
          { ok: false, error: `Key should start with "${provider.keyPrefix}".` },
          400,
        );
      }

      const sealed = await sealKey(body.key, env.KEY_ENCRYPTION_KEY);
      await env.DB.prepare(
        `INSERT INTO user_api_keys (user_id, provider, key_ciphertext, dek_wrapped, iv, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (user_id, provider) DO UPDATE SET
             key_ciphertext = excluded.key_ciphertext,
             dek_wrapped = excluded.dek_wrapped,
             iv = excluded.iv,
             created_at = excluded.created_at`,
      )
        .bind(
          uid,
          providerId,
          sealed.keyCiphertext,
          sealed.dekWrapped,
          sealed.iv,
          Math.floor(Date.now() / 1000),
        )
        .run();

      return jsonResponse({ ok: true });
    }

    // DELETE /v1/keys/:provider (auth)
    const delMatch = path.match(/^\/v1\/keys\/([a-z0-9-]+)$/);
    if (delMatch && request.method === 'DELETE') {
      const uid = await requireAuth(request, env);
      const providerId = delMatch[1];
      await env.DB.prepare('DELETE FROM user_api_keys WHERE user_id = ? AND provider = ?')
        .bind(uid, providerId)
        .run();
      return jsonResponse({ ok: true });
    }

    // GET /v1/keys (auth — HTML key management page)
    // GET /v1/keys → redirect to Console (API Keys tab)
    if (path === '/v1/keys' && request.method === 'GET') {
      return new Response(null, {
        status: 302,
        headers: { Location: '/console/#keys' },
      });
    }

    // GET /v1/usage (auth — usage stats)
    if (path === '/v1/usage' && request.method === 'GET') {
      const uid = await requireAuth(request, env);
      return await handleUsage(env.DB, uid);
    }

    // ALL /v1/proxy/:host/* (auth — proxy with key injection)
    const proxyMatch = path.match(/^\/v1\/proxy\/([^/]+)\/(.+)$/);
    if (proxyMatch) {
      return await handleProxy(request, url, env, proxyMatch[1], proxyMatch[2]);
    }

    // GET /v1/stats/:agentId — public aggregate usage stats for an agent
    const statsMatch = path.match(/^\/v1\/stats\/([a-z0-9-]+)$/);
    if (statsMatch && request.method === 'GET') {
      const agentId = statsMatch[1];
      const row = await env.DB.prepare(
        'SELECT COUNT(*) as calls, MAX(created_at) as last_used FROM usage_log WHERE agent_id = ?',
      )
        .bind(agentId)
        .first<{ calls: number; last_used: number | null }>();
      const h = corsHeaders();
      h.set('Content-Type', 'application/json; charset=utf-8');
      h.set('Cache-Control', 'public, max-age=300');
      return new Response(
        JSON.stringify({
          calls: row?.calls ?? 0,
          lastUsed: row?.last_used ? new Date(row.last_used * 1000).toISOString() : null,
        }),
        { headers: h },
      );
    }

    // GET /v1/qr?data=URL — generate QR code as SVG
    if (path === '/v1/qr' && request.method === 'GET') {
      const data = url.searchParams.get('data');
      if (!data) return jsonResponse({ error: 'Missing ?data= parameter' }, 400);
      const { generateQRSvg } = await import('./qr-endpoint');
      const svg = generateQRSvg(data);
      const h = corsHeaders();
      h.set('Content-Type', 'image/svg+xml');
      h.set('Cache-Control', 'public, max-age=300');
      return new Response(svg, { headers: h });
    }

    // GET /v1/mirror.js — serve the mirror Web Component client script
    if (path === '/v1/mirror.js' && request.method === 'GET') {
      const { MIRROR_CLIENT_JS } = await import('./mirror-inject');
      const h = corsHeaders();
      h.set('Content-Type', 'application/javascript; charset=utf-8');
      h.set('Cache-Control', 'public, max-age=3600');
      return new Response(MIRROR_CLIENT_JS, { headers: h });
    }

    // ── Mirror relay routes (Durable Object WebSocket) ──

    // GET /v1/mirror/:roomId/ws — WebSocket upgrade → Durable Object
    const mirrorWsMatch = path.match(/^\/v1\/mirror\/([a-z0-9]{6,16})\/ws$/);
    if (mirrorWsMatch && request.headers.get('Upgrade') === 'websocket') {
      const roomId = mirrorWsMatch[1];
      const id = env.MIRROR_ROOMS.idFromName(roomId);
      const room = env.MIRROR_ROOMS.get(id);
      return await room.fetch(request);
    }

    // GET /v1/mirror/:roomId — room info (peer count, no WebSocket needed)
    const mirrorInfoMatch = path.match(/^\/v1\/mirror\/([a-z0-9]{6,16})$/);
    if (mirrorInfoMatch && request.method === 'GET') {
      const roomId = mirrorInfoMatch[1];
      const id = env.MIRROR_ROOMS.idFromName(roomId);
      const room = env.MIRROR_ROOMS.get(id);
      const info = await room.fetch(new Request(`${url.origin}/info`));
      const body = await info.text();
      const h = corsHeaders();
      h.set('Content-Type', 'application/json');
      return new Response(body, { headers: h });
    }

    // POST /v1/mirror/:roomId — fallback relay via Durable Object broadcast
    if (mirrorInfoMatch && request.method === 'POST') {
      const roomId = mirrorInfoMatch[1];
      const id = env.MIRROR_ROOMS.idFromName(roomId);
      const room = env.MIRROR_ROOMS.get(id);
      return await room.fetch(request);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const requestId = crypto.randomUUID().slice(0, 8);
    console.error(
      JSON.stringify({
        level: 'error',
        requestId,
        method: request.method,
        path,
        error: String(err),
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      }),
    );
    return jsonResponse({ error: 'Internal error', requestId }, 500);
  }
}

// ── Proxy handler ────────────────────────────────────────────────────────────

const MAX_REQUEST_BODY = 512 * 1024; // 512 KB

async function handleProxy(
  request: Request,
  url: URL,
  env: Env,
  host: string,
  restPath: string,
): Promise<Response> {
  const uid = await requireAuth(request, env);
  if (!env.KEY_ENCRYPTION_KEY) {
    return jsonResponse({ error: 'Key vault not configured.' }, 503);
  }

  // Map host to provider
  const providerId = HOST_TO_PROVIDER[host.toLowerCase()];
  if (!providerId) {
    return jsonResponse({ error: `Unknown proxy host: ${host}` }, 400);
  }

  // Rate limit
  const allowed = await checkRateLimit(env.DB, uid);
  if (!allowed) {
    return jsonResponse({ error: `Rate limit exceeded (${PROXY_RATE_LIMIT} requests/hour).` }, 429);
  }

  // Look up + decrypt user key
  const row = await env.DB.prepare(
    'SELECT key_ciphertext, dek_wrapped, iv FROM user_api_keys WHERE user_id = ? AND provider = ?',
  )
    .bind(uid, providerId)
    .first<{ key_ciphertext: unknown; dek_wrapped: unknown; iv: unknown }>();

  if (!row) {
    return jsonResponse(
      {
        error: 'no_key',
        provider: providerId,
        message: `Configure your ${PROVIDER_BY_ID[providerId]?.name ?? providerId} API key first.`,
        manage_url: `/v1/keys?provider=${providerId}`,
      },
      403,
    );
  }

  const sealed: SealedKey = {
    keyCiphertext: toUint8(row.key_ciphertext),
    dekWrapped: toUint8(row.dek_wrapped),
    iv: toUint8(row.iv),
  };
  const apiKey = await openKey(sealed, env.KEY_ENCRYPTION_KEY);

  // Build upstream URL
  let upstreamUrl = `https://${host}/${restPath}`;
  if (url.search) upstreamUrl += url.search;

  // Build forward headers
  const forwardHeaders = new Headers();
  for (const [k, v] of request.headers.entries()) {
    if (!PROXY_FORWARD_SKIP.has(k.toLowerCase())) {
      forwardHeaders.set(k, v);
    }
  }

  // Inject key per provider
  if (providerId === 'anthropic') {
    forwardHeaders.set('x-api-key', apiKey);
    forwardHeaders.set('anthropic-version', '2023-06-01');
  } else if (providerId === 'google') {
    // Google: append key as query param
    const sep = upstreamUrl.includes('?') ? '&' : '?';
    upstreamUrl += `${sep}key=${apiKey}`;
  } else {
    // OpenAI, Groq, Together, OpenRouter: Bearer token
    forwardHeaders.set('Authorization', `Bearer ${apiKey}`);
  }

  // Body
  let forwardBody: BodyInit | null = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_REQUEST_BODY) {
      return jsonResponse(
        { error: `Request body too large (max ${MAX_REQUEST_BODY} bytes).` },
        413,
      );
    }
    forwardBody = buf;
  }

  // Forward
  const upstreamRes = await fetch(upstreamUrl, {
    method: request.method,
    headers: forwardHeaders,
    body: forwardBody,
  });

  // Stream the response back with CORS headers
  const respHeaders = corsHeaders();
  for (const [k, v] of upstreamRes.headers.entries()) {
    if (!PROXY_RESPONSE_SKIP.has(k.toLowerCase())) {
      respHeaders.append(k, v);
    }
  }

  // Update last_used_at probabilistically (1 in 10)
  if (Math.random() < 0.1) {
    env.DB.prepare('UPDATE user_api_keys SET last_used_at = ? WHERE user_id = ? AND provider = ?')
      .bind(Math.floor(Date.now() / 1000), uid, providerId)
      .run()
      .catch(() => {});
  }

  // Extract model from request body + agent_id from Referer
  let requestModel: string | null = null;
  let agentId: string | null = null;
  let requestTokenEstimate = 0;
  if (forwardBody) {
    try {
      const bodyText = new TextDecoder().decode(forwardBody as ArrayBuffer);
      const bodyJson = JSON.parse(bodyText);
      requestModel = bodyJson.model ?? null;
      requestTokenEstimate = Math.ceil(bodyText.length / 4);
    } catch {
      requestTokenEstimate = Math.ceil((forwardBody as ArrayBuffer).byteLength / 4);
    }
  }
  const referer = request.headers.get('Referer') ?? '';
  const agentRefMatch = referer.match(/\/a\/([a-z0-9-]+)/);
  if (agentRefMatch) agentId = agentRefMatch[1];

  // Log usage — handle streaming vs non-streaming responses
  const isStreaming = (upstreamRes.headers.get('content-type') ?? '').includes('text/event-stream');
  if (isStreaming) {
    const [clientStream, logStream] = upstreamRes.body!.tee();

    // Fire-and-forget: read the log stream to extract final usage chunk
    (async () => {
      try {
        const reader = logStream.getReader();
        const decoder = new TextDecoder();
        let lastUsage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.usage) lastUsage = parsed.usage;
            } catch {
              /* not JSON */
            }
          }
        }
        const tokensIn = lastUsage?.prompt_tokens ?? requestTokenEstimate;
        const tokensOut = lastUsage?.completion_tokens ?? 0;
        await logUsage(env.DB, uid, providerId, requestModel, tokensIn, tokensOut, agentId);
      } catch {
        /* swallow errors in background logging */
      }
    })();

    return new Response(clientStream, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: respHeaders,
    });
  }

  // Non-streaming: read body, extract usage, return
  const responseBody = await upstreamRes.arrayBuffer();
  let tokensIn = requestTokenEstimate;
  let tokensOut = Math.ceil(responseBody.byteLength / 4);
  try {
    const resJson = JSON.parse(new TextDecoder().decode(responseBody));
    if (resJson.usage) {
      tokensIn = resJson.usage.prompt_tokens ?? tokensIn;
      tokensOut = resJson.usage.completion_tokens ?? tokensOut;
    }
    if (resJson.model && !requestModel) requestModel = resJson.model;
  } catch {
    /* not JSON */
  }
  logUsage(env.DB, uid, providerId, requestModel, tokensIn, tokensOut, agentId).catch(() => {});

  return new Response(responseBody, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: respHeaders,
  });
}

// ── Usage handler ─────────────────────────────────────────────────────────────

async function handleUsage(db: D1Database, userId: string): Promise<Response> {
  const now = Math.floor(Date.now() / 1000);
  const startOfDay = now - (now % 86400);
  const startOfWeek = now - (now % 604800);
  const startOfMonth = now - (now % 2592000); // ~30 days

  const [todayRow, weekRow, monthRow, byProviderRows, recentRows] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) as requests, COALESCE(SUM(tokens_in),0) as tokens_in, COALESCE(SUM(tokens_out),0) as tokens_out, COALESCE(SUM(cost_usd),0) as cost_usd
       FROM usage_log WHERE user_id = ? AND created_at >= ?`,
      )
      .bind(userId, startOfDay)
      .first<{ requests: number; tokens_in: number; tokens_out: number; cost_usd: number }>(),

    db
      .prepare(
        `SELECT COUNT(*) as requests, COALESCE(SUM(tokens_in),0) as tokens_in, COALESCE(SUM(tokens_out),0) as tokens_out, COALESCE(SUM(cost_usd),0) as cost_usd
       FROM usage_log WHERE user_id = ? AND created_at >= ?`,
      )
      .bind(userId, startOfWeek)
      .first<{ requests: number; tokens_in: number; tokens_out: number; cost_usd: number }>(),

    db
      .prepare(
        `SELECT COUNT(*) as requests, COALESCE(SUM(tokens_in),0) as tokens_in, COALESCE(SUM(tokens_out),0) as tokens_out, COALESCE(SUM(cost_usd),0) as cost_usd
       FROM usage_log WHERE user_id = ? AND created_at >= ?`,
      )
      .bind(userId, startOfMonth)
      .first<{ requests: number; tokens_in: number; tokens_out: number; cost_usd: number }>(),

    db
      .prepare(
        `SELECT provider, model, COUNT(*) as requests, COALESCE(SUM(tokens_in),0) as tokens_in, COALESCE(SUM(tokens_out),0) as tokens_out, COALESCE(SUM(cost_usd),0) as cost_usd
       FROM usage_log WHERE user_id = ? GROUP BY provider, model ORDER BY requests DESC LIMIT 20`,
      )
      .bind(userId)
      .all<{
        provider: string;
        model: string;
        requests: number;
        tokens_in: number;
        tokens_out: number;
        cost_usd: number;
      }>(),

    db
      .prepare(
        `SELECT provider, model, tokens_in, tokens_out, cost_usd, agent_id, created_at
       FROM usage_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      )
      .bind(userId)
      .all<{
        provider: string;
        model: string;
        tokens_in: number;
        tokens_out: number;
        cost_usd: number;
        agent_id: string | null;
        created_at: number;
      }>(),
  ]);

  const fmt = (
    r: { requests: number; tokens_in: number; tokens_out: number; cost_usd: number } | null,
  ) => ({
    requests: r?.requests ?? 0,
    tokensIn: r?.tokens_in ?? 0,
    tokensOut: r?.tokens_out ?? 0,
    costUsd: Math.round((r?.cost_usd ?? 0) * 10000) / 10000,
  });

  return jsonResponse({
    today: fmt(todayRow),
    thisWeek: fmt(weekRow),
    thisMonth: fmt(monthRow),
    byProvider: (byProviderRows.results ?? []).map((r) => ({
      provider: r.provider,
      model: r.model,
      requests: r.requests,
      tokensIn: r.tokens_in,
      tokensOut: r.tokens_out,
      costUsd: Math.round(r.cost_usd * 10000) / 10000,
    })),
    recentCalls: (recentRows.results ?? []).map((r) => ({
      provider: r.provider,
      model: r.model,
      tokensIn: r.tokens_in,
      tokensOut: r.tokens_out,
      costUsd: Math.round((r.cost_usd ?? 0) * 10000) / 10000,
      agentId: r.agent_id,
      createdAt: r.created_at,
    })),
  });
}
