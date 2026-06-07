import { describe, it, expect } from 'vitest';
import { classify } from './heuristic';

describe('AGENTNAME classifier', () => {
  it('classifies positive input', () => {
    const r = classify('input that should match your-keyword');
    expect(r.match).toBe(true);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it('classifies negative input', () => {
    const r = classify('input that should not match');
    expect(r.match).toBe(false);
  });

  it('returns signals array', () => {
    const r = classify('anything');
    expect(r.signals).toBeInstanceOf(Array);
    expect(r.signals.length).toBeGreaterThan(0);
  });

  it('confidence is always 0-1', () => {
    const r = classify('your-keyword '.repeat(100));
    expect(r.confidence).toBeLessThanOrEqual(1);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
  });

  it('handles empty input', () => {
    const r = classify('');
    expect(r.match).toBe(false);
    expect(r.confidence).toBe(0);
  });
});
