import { describe, expect, it } from 'vitest';
import { injectMirror, MIRROR_CLIENT_JS } from './mirror-inject';

describe('injectMirror', () => {
  it('injects script and web component before </body>', () => {
    const html = '<html><body><h1>Hello</h1></body></html>';
    const result = injectMirror(html, 'my-agent');
    expect(result).toContain('<script src="/v1/mirror.js" defer></script>');
    expect(result).toContain('<fags-mirror agent="my-agent"></fags-mirror>');
    expect(result).toContain('</body>');
  });

  it('returns html unchanged if no </body> tag', () => {
    const html = '<html><h1>No body tag</h1></html>';
    expect(injectMirror(html, 'test')).toBe(html);
  });

  it('sanitizes slug with special characters', () => {
    const html = '<html><body></body></html>';
    const result = injectMirror(html, 'test<script>"alert&');
    // Should strip dangerous chars
    expect(result).not.toContain('<script>"alert&');
    expect(result).toContain('agent="testscriptalert"');
  });

  it('preserves content before and after </body>', () => {
    const html =
      '<!DOCTYPE html><html><head><title>T</title></head><body><div>content</div></body></html>';
    const result = injectMirror(html, 'slug');
    expect(result).toContain('<div>content</div>');
    expect(result).toContain('</html>');
    expect(result.indexOf('<fags-mirror')).toBeLessThan(result.indexOf('</body>'));
  });
});

describe('MIRROR_CLIENT_JS', () => {
  it('is a non-empty string', () => {
    expect(typeof MIRROR_CLIENT_JS).toBe('string');
    expect(MIRROR_CLIENT_JS.length).toBeGreaterThan(100);
  });

  it('defines the FagsMirrorElement class', () => {
    expect(MIRROR_CLIENT_JS).toContain('class FagsMirrorElement');
  });

  it('registers the custom element', () => {
    expect(MIRROR_CLIENT_JS).toContain('customElements.define("fags-mirror"');
  });

  it('includes WebSocket connection logic', () => {
    expect(MIRROR_CLIENT_JS).toContain('new WebSocket');
    expect(MIRROR_CLIENT_JS).toContain('/v1/mirror/');
  });

  it('includes Shadow DOM rendering', () => {
    expect(MIRROR_CLIENT_JS).toContain('attachShadow');
  });

  it('wraps in IIFE', () => {
    expect(MIRROR_CLIENT_JS).toMatch(/^\(function\(\)/);
    expect(MIRROR_CLIENT_JS).toMatch(/\}\)\(\);\s*$/);
  });
});
