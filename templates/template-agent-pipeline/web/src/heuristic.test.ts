import { describe, it, expect } from 'vitest';
import { runPipeline } from './heuristic';

describe('AGENTNAME pipeline', () => {
  it('runs all steps on valid input', () => {
    const html = '<form><input type="text" name="foo" /></form>';
    const r = runPipeline(html);
    expect(r.steps.every(s => s.status === 'pass')).toBe(true);
    expect(r.action).not.toBeNull();
  });

  it('short-circuits on classification failure', () => {
    const html = '<div>No form here</div>';
    const r = runPipeline(html);
    expect(r.steps[0].status).toBe('fail');
    expect(r.steps[1].status).toBe('skip');
    expect(r.action).toBeNull();
  });

  it('produces an action with confidence', () => {
    const html = '<form><input type="email" /></form>';
    const r = runPipeline(html);
    if (r.action) {
      expect(r.action.confidence).toBeGreaterThan(0);
      expect(r.action.confidence).toBeLessThanOrEqual(1);
      expect(r.action.type).toBeTruthy();
    }
  });

  it('records timing per step', () => {
    const html = '<form><input /></form>';
    const r = runPipeline(html);
    for (const step of r.steps) {
      if (step.status !== 'skip') {
        expect(step.timeMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('handles empty input', () => {
    const r = runPipeline('');
    expect(r.steps[0].status).toBe('fail');
    expect(r.action).toBeNull();
  });
});
