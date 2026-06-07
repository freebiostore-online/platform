import { describe, expect, it } from 'vitest';
import type { RecordedAction } from './index';
import { buildCondensePrompt, replayScript } from './index';

describe('buildCondensePrompt', () => {
  it('includes recorded actions', () => {
    const actions: RecordedAction[] = [
      {
        type: 'click',
        timestamp: 0,
        target: { selector: '#submit', tag: 'button', text: 'Submit' },
      },
      {
        type: 'fill',
        timestamp: 100,
        target: { selector: 'input[name="email"]', tag: 'input' },
        value: 'test@example.com',
      },
    ];
    const prompt = buildCondensePrompt(actions, 'fillForm');
    expect(prompt).toContain('CLICK #submit');
    expect(prompt).toContain('FILL input[name="email"]');
    expect(prompt).toContain('fillForm');
    expect(prompt).toContain('document.querySelector');
  });

  it('handles empty actions', () => {
    const prompt = buildCondensePrompt([], 'emptyScript');
    expect(prompt).toContain('emptyScript');
  });
});

describe('replayScript', () => {
  it('executes valid code', async () => {
    const result = await replayScript('data.ran = true', { ran: false });
    expect(result.success).toBe(true);
  });

  it('returns error for invalid code', async () => {
    const result = await replayScript('throw new Error("test failure")');
    expect(result.success).toBe(false);
    expect(result.error).toContain('test failure');
  });

  it('passes data to the script', async () => {
    let captured = '';
    (globalThis as any).__testCapture = (v: string) => {
      captured = v;
    };
    await replayScript('globalThis.__testCapture(data.name)', { name: 'hello' });
    expect(captured).toBe('hello');
    delete (globalThis as any).__testCapture;
  });
});
