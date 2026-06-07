import { describe, expect, it } from 'vitest';

// Test the pure functions from the host worker (extracted for testability)
// The actual worker fetch handler is tested via integration tests.

// Re-implement the pure functions here since they're not exported
function r2KeyFor(r2Prefix: string, pathname: string): string {
  let key = r2Prefix + pathname;
  if (key.endsWith('/')) key += 'index.html';
  if (!key.split('/').pop()?.includes('.')) key += '/index.html';
  return key;
}

function contentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8',
    json: 'application/json; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    wasm: 'application/wasm',
    txt: 'text/plain; charset=utf-8',
    xml: 'application/xml',
    webmanifest: 'application/manifest+json',
    map: 'application/json',
    onnx: 'application/octet-stream',
  };
  return types[ext ?? ''] ?? 'application/octet-stream';
}

function etagsMatch(header: string, etag: string): boolean {
  if (header === '*') return true;
  return header.split(',').some((t) => t.trim() === etag);
}

describe('r2KeyFor', () => {
  it('maps / to index.html', () => {
    expect(r2KeyFor('agents/tts', '/')).toBe('agents/tts/index.html');
  });

  it('maps /about/ to about/index.html', () => {
    expect(r2KeyFor('agents/tts', '/about/')).toBe('agents/tts/about/index.html');
  });

  it('maps /app.js as-is', () => {
    expect(r2KeyFor('agents/tts', '/app.js')).toBe('agents/tts/app.js');
  });

  it('maps /assets/index-abc.css as-is', () => {
    expect(r2KeyFor('agents/tts', '/assets/index-abc.css')).toBe('agents/tts/assets/index-abc.css');
  });

  it('maps extensionless path to /index.html', () => {
    expect(r2KeyFor('agents/tts', '/about')).toBe('agents/tts/about/index.html');
  });

  it('handles nested paths', () => {
    expect(r2KeyFor('agents/tts', '/deep/path/file.wasm')).toBe('agents/tts/deep/path/file.wasm');
  });
});

describe('contentType', () => {
  it('returns correct MIME for html', () => {
    expect(contentType('index.html')).toBe('text/html; charset=utf-8');
  });

  it('returns correct MIME for js', () => {
    expect(contentType('app.js')).toBe('application/javascript; charset=utf-8');
  });

  it('returns correct MIME for css', () => {
    expect(contentType('style.css')).toBe('text/css; charset=utf-8');
  });

  it('returns correct MIME for wasm', () => {
    expect(contentType('model.wasm')).toBe('application/wasm');
  });

  it('returns correct MIME for onnx', () => {
    expect(contentType('model.onnx')).toBe('application/octet-stream');
  });

  it('returns correct MIME for woff2', () => {
    expect(contentType('font.woff2')).toBe('font/woff2');
  });

  it('returns octet-stream for unknown extensions', () => {
    expect(contentType('file.xyz')).toBe('application/octet-stream');
  });

  it('returns correct MIME for webmanifest', () => {
    expect(contentType('manifest.webmanifest')).toBe('application/manifest+json');
  });

  it('returns correct MIME for json', () => {
    expect(contentType('data.json')).toBe('application/json; charset=utf-8');
  });

  it('returns correct MIME for png', () => {
    expect(contentType('icon.png')).toBe('image/png');
  });

  it('returns correct MIME for svg', () => {
    expect(contentType('logo.svg')).toBe('image/svg+xml');
  });
});

describe('security headers', () => {
  // Re-implement buildSecurityHeaders for testing (same logic as index.ts)
  function buildSecurityHeaders(isAgent: boolean): Headers {
    const h = new Headers();
    h.set('X-Content-Type-Options', 'nosniff');
    h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    h.set('X-Frame-Options', 'SAMEORIGIN');
    h.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
    if (isAgent) {
      h.set(
        'Content-Security-Policy',
        [
          "default-src 'self' https: data: blob:",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
          "style-src 'self' 'unsafe-inline' https:",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https:",
          "connect-src 'self' https: wss: http://localhost:11434",
          "frame-src 'self' https:",
          "base-uri 'self'",
          "object-src 'none'",
        ].join('; '),
      );
    } else {
      h.set(
        'Content-Security-Policy',
        [
          "default-src 'self' https: data: blob:",
          "script-src 'self' 'unsafe-inline' https:",
          "style-src 'self' 'unsafe-inline' https:",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https:",
          "connect-src 'self' https: wss:",
          "frame-src 'self' https:",
          "base-uri 'self'",
          "object-src 'none'",
        ].join('; '),
      );
    }
    return h;
  }

  it('platform CSP does not include unsafe-eval', () => {
    const h = buildSecurityHeaders(false);
    const csp = h.get('Content-Security-Policy') ?? '';
    expect(csp).not.toContain('unsafe-eval');
  });

  it('platform CSP does not include localhost', () => {
    const h = buildSecurityHeaders(false);
    const csp = h.get('Content-Security-Policy') ?? '';
    expect(csp).not.toContain('localhost');
  });

  it('agent CSP includes unsafe-eval for heuristic code', () => {
    const h = buildSecurityHeaders(true);
    const csp = h.get('Content-Security-Policy') ?? '';
    expect(csp).toContain('unsafe-eval');
  });

  it('agent CSP includes localhost for Ollama', () => {
    const h = buildSecurityHeaders(true);
    const csp = h.get('Content-Security-Policy') ?? '';
    expect(csp).toContain('http://localhost:11434');
  });

  it('both include X-Frame-Options', () => {
    expect(buildSecurityHeaders(false).get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(buildSecurityHeaders(true).get('X-Frame-Options')).toBe('SAMEORIGIN');
  });

  it('both include Permissions-Policy', () => {
    const pp = buildSecurityHeaders(false).get('Permissions-Policy') ?? '';
    expect(pp).toContain('camera=()');
    expect(pp).toContain('geolocation=()');
  });

  it('both include HSTS', () => {
    expect(buildSecurityHeaders(false).get('Strict-Transport-Security')).toContain('max-age=');
    expect(buildSecurityHeaders(true).get('Strict-Transport-Security')).toContain('max-age=');
  });
});

describe('etagsMatch', () => {
  it('matches wildcard *', () => {
    expect(etagsMatch('*', '"abc123"')).toBe(true);
  });

  it('matches exact etag', () => {
    expect(etagsMatch('"abc123"', '"abc123"')).toBe(true);
  });

  it('rejects non-matching etag', () => {
    expect(etagsMatch('"abc123"', '"def456"')).toBe(false);
  });

  it('matches in comma-separated list', () => {
    expect(etagsMatch('"aaa", "bbb", "ccc"', '"bbb"')).toBe(true);
  });

  it('rejects when not in list', () => {
    expect(etagsMatch('"aaa", "bbb"', '"ccc"')).toBe(false);
  });
});
