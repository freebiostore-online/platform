import { describe, expect, it } from 'vitest';
import type { HeuristicExample, HeuristicSpec } from './heuristic.js';
import { buildEvolvePrompt, evaluateHeuristic, extractCode } from './heuristic.js';

describe('evaluateHeuristic', () => {
  it('scores perfect code as 1.0', () => {
    const code = 'return input * 2';
    const examples: HeuristicExample[] = [
      { input: 1, expectedOutput: 2 },
      { input: 5, expectedOutput: 10 },
      { input: 0, expectedOutput: 0 },
    ];
    const result = evaluateHeuristic(code, examples);
    expect(result.score).toBe(1);
    expect(result.passed).toBe(3);
    expect(result.total).toBe(3);
    expect(result.failures).toHaveLength(0);
  });

  it('scores failing code correctly', () => {
    const code = 'return input + 1'; // wrong: should be *2
    const examples: HeuristicExample[] = [
      { input: 1, expectedOutput: 2 }, // 1+1=2 ✓ (lucky pass)
      { input: 5, expectedOutput: 10 }, // 5+1=6 ✗
      { input: 3, expectedOutput: 6 }, // 3+1=4 ✗
    ];
    const result = evaluateHeuristic(code, examples);
    expect(result.passed).toBe(1);
    expect(result.total).toBe(3);
    expect(result.failures).toHaveLength(2);
  });

  it('handles code compilation errors', () => {
    const code = 'this is not valid javascript {{{';
    const examples: HeuristicExample[] = [{ input: 1, expectedOutput: 2 }];
    const result = evaluateHeuristic(code, examples);
    expect(result.score).toBe(0);
    expect(result.failures[0].error).toContain('compilation error');
  });

  it('handles runtime errors in code', () => {
    const code = 'return input.nonexistent.property';
    const examples: HeuristicExample[] = [{ input: 5, expectedOutput: 10 }];
    const result = evaluateHeuristic(code, examples);
    expect(result.score).toBe(0);
    expect(result.failures[0].error).toBeDefined();
  });

  it('supports weighted examples', () => {
    const code = 'return input > 0 ? "positive" : "negative"';
    const examples: HeuristicExample[] = [
      { input: 5, expectedOutput: 'positive', weight: 10 },
      { input: -3, expectedOutput: 'negative', weight: 1 },
      { input: 0, expectedOutput: 'zero', weight: 1 }, // will fail
    ];
    const result = evaluateHeuristic(code, examples);
    // 10/12 + 1/12 = 11/12 ≈ 0.917
    expect(result.score).toBeCloseTo(11 / 12, 2);
  });

  it('works with object inputs/outputs', () => {
    const code = 'return { sum: input.a + input.b, product: input.a * input.b }';
    const examples: HeuristicExample[] = [
      { input: { a: 2, b: 3 }, expectedOutput: { sum: 5, product: 6 } },
      { input: { a: 0, b: 7 }, expectedOutput: { sum: 7, product: 0 } },
    ];
    const result = evaluateHeuristic(code, examples);
    expect(result.score).toBe(1);
    expect(result.passed).toBe(2);
  });

  it('works with string classification', () => {
    const code = `
      const email = input;
      if (email.includes('@') && email.includes('.')) return 'valid';
      return 'invalid';
    `;
    const examples: HeuristicExample[] = [
      { input: 'user@example.com', expectedOutput: 'valid' },
      { input: 'not-an-email', expectedOutput: 'invalid' },
      { input: 'nope', expectedOutput: 'invalid' }, // no @ or .
    ];
    const result = evaluateHeuristic(code, examples);
    expect(result.passed).toBe(3);
  });

  it('supports custom scoring function', () => {
    const code = 'return Math.round(input * 2.1)'; // approximately doubling
    const examples: HeuristicExample[] = [
      { input: 5, expectedOutput: 10 },
      { input: 10, expectedOutput: 20 },
    ];
    // Allow ±1 tolerance
    const scoreFn = 'return Math.abs(actual - expected) <= 1 ? 1 : 0';
    const result = evaluateHeuristic(code, examples, scoreFn);
    expect(result.score).toBe(1); // 10.5→11 (close to 10), 21 (close to 20)
  });
});

describe('buildEvolvePrompt', () => {
  it('builds a prompt with description and examples', () => {
    const spec: HeuristicSpec = {
      description: 'Double the input number',
      inputType: 'number',
      outputType: 'number',
      examples: [
        { input: 1, expectedOutput: 2 },
        { input: 5, expectedOutput: 10 },
      ],
      history: [],
    };
    const prompt = buildEvolvePrompt(spec);
    expect(prompt).toContain('Double the input number');
    expect(prompt).toContain('Input: 1');
    expect(prompt).toContain('Expected: 2');
    expect(prompt).toContain('DETERMINISTIC');
  });

  it('includes current code and failures when evolving', () => {
    const spec: HeuristicSpec = {
      description: 'Classify sentiment',
      inputType: 'string',
      outputType: '"positive" | "negative" | "neutral"',
      examples: [{ input: 'great product', expectedOutput: 'positive' }],
      currentCode: 'return "neutral"',
      history: [
        {
          version: 1,
          code: 'return "neutral"',
          score: 0.3,
          passCount: 3,
          totalCount: 10,
          timestamp: Date.now(),
        },
      ],
    };
    const evalResult = {
      score: 0.3,
      passed: 3,
      total: 10,
      failures: [{ input: 'great product', expected: 'positive', actual: 'neutral' }],
    };
    const prompt = buildEvolvePrompt(spec, evalResult);
    expect(prompt).toContain('Current Code');
    expect(prompt).toContain('return "neutral"');
    expect(prompt).toContain('30.0%');
    expect(prompt).toContain('Failures');
  });
});

describe('extractCode', () => {
  it('strips markdown fences', () => {
    const response = '```javascript\nreturn input * 2\n```';
    expect(extractCode(response)).toBe('return input * 2');
  });

  it('strips generic fences', () => {
    const response = '```\nreturn input * 2\n```';
    expect(extractCode(response)).toBe('return input * 2');
  });

  it('returns plain text as-is', () => {
    const response = 'return input * 2';
    expect(extractCode(response)).toBe('return input * 2');
  });
});
