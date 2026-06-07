import { describe, it, expect } from 'vitest';
import { extract } from './heuristic';

describe('AGENTNAME extractor', () => {
  it('returns empty fields for empty input', () => {
    const r = extract('');
    expect(r.fields).toHaveLength(0);
  });

  it('returns metadata with field count', () => {
    const r = extract('<div>no inputs</div>');
    expect(r.metadata.fieldCount).toBe(0);
  });

  it('skips hidden and submit inputs', () => {
    const html = `
      <input type="hidden" name="csrf" />
      <input type="submit" value="Go" />
    `;
    const r = extract(html);
    expect(r.fields).toHaveLength(0);
  });

  // TODO: Add tests for your specific extraction rules
  // it('extracts email field', () => {
  //   const html = '<input type="email" name="email" />';
  //   const r = extract(html);
  //   expect(r.fields[0].role).toBe('email');
  // });
});
