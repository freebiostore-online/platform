import { describe, expect, it } from 'vitest';
import {
  createAgentInstance,
  createBlankConfig,
  exportConfig,
  importConfig,
} from './agent-config.js';

describe('createBlankConfig', () => {
  it('creates a config with required fields', () => {
    const config = createBlankConfig('resume-parser', '1.0.0', 'my-custom-parser');
    expect(config.baseAgent).toBe('resume-parser');
    expect(config.baseVersion).toBe('1.0.0');
    expect(config.instanceName).toBe('my-custom-parser');
    expect(config.examples).toEqual([]);
    expect(config.accuracy).toBe(0);
  });
});

describe('createAgentInstance', () => {
  it('uses base run function when no evolved code', () => {
    const config = createBlankConfig('test', '1.0', 'test-instance');
    const baseFn = (input: number) => input * 2;
    const instance = createAgentInstance(baseFn, config);
    expect(instance.run(5)).toBe(10);
    expect(instance.baseAgent).toBe('test');
    expect(instance.instanceName).toBe('test-instance');
  });

  it('uses evolved code when provided', () => {
    const config = createBlankConfig('test', '1.0', 'evolved');
    config.evolvedCode = 'return input * 3';
    const baseFn = (input: number) => input * 2;
    const instance = createAgentInstance(baseFn, config);
    expect(instance.run(5)).toBe(15); // evolved: *3, not base *2
  });

  it('falls back to base if evolved code fails to compile', () => {
    const config = createBlankConfig('test', '1.0', 'broken');
    config.evolvedCode = 'this is not valid {{{';
    const baseFn = (input: number) => input * 2;
    const instance = createAgentInstance(baseFn, config);
    expect(instance.run(5)).toBe(10); // falls back to base
  });
});

describe('exportConfig / importConfig', () => {
  it('round-trips correctly', () => {
    const original = createBlankConfig('sentiment', '1.0.0', 'my-sentiment');
    original.systemPrompt = 'Focus on product reviews';
    original.accuracy = 85;

    const json = exportConfig(original);
    const imported = importConfig(json);

    expect(imported.baseAgent).toBe('sentiment');
    expect(imported.instanceName).toBe('my-sentiment');
    expect(imported.systemPrompt).toBe('Focus on product reviews');
    expect(imported.accuracy).toBe(85);
  });

  it('throws on invalid config', () => {
    expect(() => importConfig('{}')).toThrow('missing baseAgent');
  });

  it('throws on invalid JSON', () => {
    expect(() => importConfig('not json')).toThrow();
  });
});
