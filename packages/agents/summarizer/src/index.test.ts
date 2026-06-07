import { describe, expect, it } from 'vitest';
import {
  buildPromptFromConfig,
  createDefaultConfig,
  createMeetingNotesConfig,
  heuristicSummarize,
} from './index';

describe('configs', () => {
  it('default config has no extract fields', () => {
    const c = createDefaultConfig();
    expect(c.extractFields).toEqual([]);
    expect(c.trainedOn).toBe(0);
  });

  it('meeting notes config has required fields', () => {
    const c = createMeetingNotesConfig();
    expect(c.extractFields.length).toBeGreaterThan(3);
    expect(c.extractFields.find((f) => f.name === 'decisions')?.required).toBe(true);
    expect(c.extractFields.find((f) => f.name === 'actionItems')?.required).toBe(true);
  });
});

describe('buildPromptFromConfig', () => {
  it('includes extract fields in prompt', () => {
    const c = createMeetingNotesConfig();
    const prompt = buildPromptFromConfig(c, 'We decided to launch next Monday.');
    expect(prompt).toContain('decisions');
    expect(prompt).toContain('actionItems');
    expect(prompt).toContain('launch next Monday');
  });
});

describe('heuristicSummarize', () => {
  it('returns short text as-is', () => {
    expect(heuristicSummarize('Hello world.')).toBe('Hello world.');
  });

  it('extracts key sentences from long text', () => {
    const text =
      'The experiment began in January. We collected data from 500 participants. The weather was nice. Results show a significant improvement of 30%. Several limitations exist. In conclusion, the method works.';
    const summary = heuristicSummarize(text, 3);
    expect(summary).toContain('experiment began');
    expect(summary).toContain('conclusion');
    expect(summary.split('.').length).toBeLessThanOrEqual(4);
  });

  it('prioritizes first and last sentences', () => {
    const text =
      'First important point. Some filler. More filler. Another filler. Last conclusion point.';
    const summary = heuristicSummarize(text, 2);
    expect(summary).toContain('First');
    expect(summary).toContain('Last');
  });
});
