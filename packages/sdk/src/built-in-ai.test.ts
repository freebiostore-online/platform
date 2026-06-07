import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectBuiltInAI, smartPrompt } from './built-in-ai.js';

describe('detectBuiltInAI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Clear any global mocks
    const g = globalThis as any;
    delete g.LanguageModel;
    delete g.Summarizer;
    delete g.Writer;
    delete g.Rewriter;
    delete g.Translator;
    delete g.LanguageDetector;
    delete g.ai;
  });

  it('returns all unavailable when no APIs exist', async () => {
    const caps = await detectBuiltInAI();
    expect(caps.prompt).toBe('unavailable');
    expect(caps.summarizer).toBe('unavailable');
    expect(caps.writer).toBe('unavailable');
    expect(caps.translator).toBe('unavailable');
  });

  it('detects available LanguageModel', async () => {
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
    };
    const caps = await detectBuiltInAI();
    expect(caps.prompt).toBe('available');
  });

  it('detects downloadable model', async () => {
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue('after-download'),
    };
    const caps = await detectBuiltInAI();
    expect(caps.prompt).toBe('downloadable');
  });

  it('detects via ai.languageModel path', async () => {
    (globalThis as any).ai = {
      languageModel: { availability: vi.fn().mockResolvedValue('readily') },
    };
    const caps = await detectBuiltInAI();
    expect(caps.prompt).toBe('available');
  });

  it('detects Summarizer separately', async () => {
    (globalThis as any).Summarizer = {
      availability: vi.fn().mockResolvedValue('available'),
    };
    const caps = await detectBuiltInAI();
    expect(caps.summarizer).toBe('available');
    expect(caps.prompt).toBe('unavailable'); // only summarizer
  });

  it('handles availability() throwing', async () => {
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockRejectedValue(new Error('not supported')),
    };
    const caps = await detectBuiltInAI();
    expect(caps.prompt).toBe('unavailable');
  });
});

describe('smartPrompt', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const g = globalThis as any;
    delete g.LanguageModel;
    delete g.ai;
  });

  it('uses built-in AI when available', async () => {
    const mockSession = {
      prompt: vi.fn().mockResolvedValue('Built-in response'),
      destroy: vi.fn(),
    };
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue(mockSession),
    };

    const { result, source } = await smartPrompt('test input');
    expect(result).toBe('Built-in response');
    expect(source).toBe('built-in');
  });

  it('falls back to heuristic when nothing available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no ollama')));

    const { result, source } = await smartPrompt('test', {
      heuristicFallback: (input) => `heuristic: ${input}`,
    });
    expect(result).toBe('heuristic: test');
    expect(source).toBe('heuristic');
  });

  it('throws when no fallback available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no ollama')));
    await expect(smartPrompt('test')).rejects.toThrow('No AI available');
  });
});
