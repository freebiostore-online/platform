import { describe, expect, it } from 'vitest';
import { generateQRSvg } from './qr-endpoint';

describe('generateQRSvg', () => {
  it('returns valid SVG', () => {
    const svg = generateQRSvg('https://example.com');
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/<\/svg>$/);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('contains purple modules', () => {
    const svg = generateQRSvg('test');
    expect(svg).toContain('fill="#7c3aed"');
  });

  it('has white background', () => {
    const svg = generateQRSvg('test');
    expect(svg).toContain('fill="white"');
  });

  it('encodes different data differently', () => {
    const svg1 = generateQRSvg('hello');
    const svg2 = generateQRSvg('world');
    expect(svg1).not.toBe(svg2);
  });

  it('handles URLs with query params', () => {
    const svg = generateQRSvg('https://freebiostore.online/mirror/?room=abc123&agent=chat');
    expect(svg).toMatch(/^<svg /);
    // URL with query params produces a larger QR
    expect(svg.length).toBeGreaterThan(500);
  });

  it('handles empty string', () => {
    const svg = generateQRSvg('');
    expect(svg).toMatch(/^<svg /);
  });

  it('has consistent viewBox and dimensions', () => {
    const svg = generateQRSvg('test');
    const widthMatch = svg.match(/width="(\d+)"/);
    const heightMatch = svg.match(/height="(\d+)"/);
    const viewBoxMatch = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    expect(widthMatch).not.toBeNull();
    expect(heightMatch).not.toBeNull();
    expect(viewBoxMatch).not.toBeNull();
    expect(widthMatch![1]).toBe(heightMatch![1]); // square
    expect(widthMatch![1]).toBe(viewBoxMatch![1]); // matches viewBox
  });
});
