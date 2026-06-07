/**
 * Heuristic Agent Runtime
 *
 * A heuristic agent is "living code" — deterministic JS/TS functions
 * that encode knowledge WITHOUT needing an LLM at runtime.
 *
 * The lifecycle:
 * 1. SEED: LLM generates initial heuristic code from a description
 * 2. TEST: Code runs against examples/data → produce scores
 * 3. EVOLVE: LLM sees scores + failures → rewrites code to improve
 * 4. REPEAT: Each iteration makes the code smarter
 * 5. SHIP: Final code runs in browser at zero cost, no model needed
 *
 * Inspired by:
 * - FunSearch (DeepMind): LLM + evaluator loop evolving heuristics
 * - WorldCoder (NeurIPS 2024): code as world model, 10000x faster than RL
 * - AlphaEvolve (DeepMind 2025): evolutionary code optimization
 *
 * The output is PURE JS — no models, no inference, no WebGPU.
 * Just code that runs instantly everywhere.
 */

export interface HeuristicSpec {
  /** What this heuristic does (natural language). */
  description: string;
  /** Function signature: input type name and output type name. */
  inputType: string;
  outputType: string;
  /** Example input/output pairs for testing. */
  examples: HeuristicExample[];
  /** Optional: scoring function source (JS). If not provided, uses exact match. */
  scoreFn?: string;
  /** Current version of the heuristic code. */
  currentCode?: string;
  /** History of all evolved versions with their scores. */
  history: HeuristicVersion[];
}

export interface HeuristicExample {
  input: unknown;
  expectedOutput: unknown;
  /** Optional weight (default 1). Higher = more important to get right. */
  weight?: number;
}

export interface HeuristicVersion {
  version: number;
  code: string;
  score: number;
  passCount: number;
  totalCount: number;
  timestamp: number;
  /** What the LLM changed in this version. */
  changelog?: string;
}

export interface EvalResult {
  score: number;
  passed: number;
  total: number;
  failures: { input: unknown; expected: unknown; actual: unknown; error?: string }[];
}

/**
 * Evaluate heuristic code against examples.
 * Runs the code in a sandboxed Function constructor (no eval).
 */
export function evaluateHeuristic(
  code: string,
  examples: HeuristicExample[],
  scoreFn?: string,
): EvalResult {
  const failures: EvalResult['failures'] = [];
  let passed = 0;

  // Create the heuristic function from code
  let heuristicFn: (input: unknown) => unknown;
  try {
    // The code should export a default function
    // We wrap it so `return` works at the top level
    heuristicFn = new Function('input', code) as (input: unknown) => unknown;
  } catch (e) {
    return {
      score: 0,
      passed: 0,
      total: examples.length,
      failures: examples.map((ex) => ({
        input: ex.input,
        expected: ex.expectedOutput,
        actual: null,
        error: `Code compilation error: ${e instanceof Error ? e.message : String(e)}`,
      })),
    };
  }

  // Create scoring function (default: exact JSON match)
  let scorer: (actual: unknown, expected: unknown) => number;
  if (scoreFn) {
    try {
      scorer = new Function('actual', 'expected', scoreFn) as (a: unknown, e: unknown) => number;
    } catch {
      scorer = defaultScorer;
    }
  } else {
    scorer = defaultScorer;
  }

  let totalScore = 0;
  let totalWeight = 0;

  for (const example of examples) {
    const weight = example.weight ?? 1;
    totalWeight += weight;

    try {
      const actual = heuristicFn(example.input);
      const exampleScore = scorer(actual, example.expectedOutput);
      totalScore += exampleScore * weight;

      if (exampleScore >= 1) {
        passed++;
      } else {
        failures.push({
          input: example.input,
          expected: example.expectedOutput,
          actual,
        });
      }
    } catch (e) {
      failures.push({
        input: example.input,
        expected: example.expectedOutput,
        actual: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    score: totalWeight > 0 ? totalScore / totalWeight : 0,
    passed,
    total: examples.length,
    failures,
  };
}

function defaultScorer(actual: unknown, expected: unknown): number {
  return JSON.stringify(actual) === JSON.stringify(expected) ? 1 : 0;
}

/**
 * Build the prompt for an LLM to generate/improve heuristic code.
 */
export function buildEvolvePrompt(spec: HeuristicSpec, evalResult?: EvalResult): string {
  const parts: string[] = [];

  parts.push(`# Heuristic Code Generation\n`);
  parts.push(`## Task\n${spec.description}\n`);
  parts.push(`## Function Signature\nInput: ${spec.inputType}\nOutput: ${spec.outputType}\n`);

  // Show examples
  parts.push(`## Examples (${spec.examples.length} total)\n`);
  const showExamples = spec.examples.slice(0, 20); // Cap at 20 for prompt size
  for (const ex of showExamples) {
    parts.push(
      `- Input: ${JSON.stringify(ex.input)} → Expected: ${JSON.stringify(ex.expectedOutput)}`,
    );
  }
  if (spec.examples.length > 20) {
    parts.push(`... and ${spec.examples.length - 20} more examples`);
  }

  // Show current code if evolving
  if (spec.currentCode) {
    parts.push(`\n## Current Code (to improve)\n\`\`\`javascript\n${spec.currentCode}\n\`\`\``);
  }

  // Show eval results if available
  if (evalResult) {
    parts.push(
      `\n## Current Score: ${(evalResult.score * 100).toFixed(1)}% (${evalResult.passed}/${evalResult.total} passed)\n`,
    );
    if (evalResult.failures.length > 0) {
      parts.push(`## Failures (fix these):`);
      for (const f of evalResult.failures.slice(0, 10)) {
        parts.push(`- Input: ${JSON.stringify(f.input)}`);
        parts.push(`  Expected: ${JSON.stringify(f.expected)}`);
        parts.push(`  Got: ${JSON.stringify(f.actual)}${f.error ? ` (Error: ${f.error})` : ''}`);
      }
    }
  }

  // Show version history for context
  if (spec.history.length > 0) {
    parts.push(`\n## Version History (${spec.history.length} versions)`);
    for (const v of spec.history.slice(-5)) {
      parts.push(
        `- v${v.version}: ${(v.score * 100).toFixed(1)}% (${v.passCount}/${v.totalCount})${v.changelog ? ` — ${v.changelog}` : ''}`,
      );
    }
  }

  parts.push(`\n## Instructions`);
  parts.push(
    `Write a JavaScript function body that takes \`input\` as parameter and returns the result.`,
  );
  parts.push(`The code must be DETERMINISTIC — same input always produces same output.`);
  parts.push(`Do NOT use any external libraries, APIs, or models.`);
  parts.push(`Use only: if/else, switch, loops, Math, String, Array, Object, RegExp, Map, Set.`);
  parts.push(
    `The code should be the function BODY only (no function declaration, just the code that goes inside).`,
  );
  parts.push(`\nRespond with ONLY the JavaScript code, no explanation.`);

  return parts.join('\n');
}

/**
 * Extract code from LLM response (strips markdown fences if present).
 */
export function extractCode(response: string): string {
  // Strip ```javascript ... ``` or ``` ... ```
  const fenceMatch = response.match(/```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Strip leading/trailing whitespace
  return response.trim();
}
