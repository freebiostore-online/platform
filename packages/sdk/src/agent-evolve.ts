/**
 * Agent Evolution — train/improve agent configs using built-in AI.
 *
 * Uses the same FunSearch-style loop as the heuristic SDK, but applied
 * to agent configs: feed examples → AI writes code → eval → improve.
 *
 * AI priority: Chrome built-in → Ollama → throws.
 */

import type { AgentConfig, EvolutionEntry, TrainingExample } from './agent-config.js';
import { smartPrompt } from './built-in-ai.js';
import { buildEvolvePrompt, evaluateHeuristic, extractCode } from './heuristic.js';

export interface EvolveResult {
  config: AgentConfig;
  score: number;
  passed: number;
  total: number;
  source: 'built-in' | 'ollama' | 'heuristic';
  previousScore: number;
}

/**
 * Evolve an agent config by feeding it new examples.
 * Uses built-in AI (Chrome/Edge) or Ollama to rewrite the heuristic code.
 */
export async function evolveAgentConfig(
  config: AgentConfig,
  newExamples?: TrainingExample[],
): Promise<EvolveResult> {
  // Merge new examples with existing
  const allExamples = [...(config.examples ?? []), ...(newExamples ?? [])];

  // Evaluate current code against all examples
  const currentCode = config.evolvedCode ?? '';
  const currentEval = currentCode
    ? evaluateHeuristic(
        currentCode,
        allExamples.map((e) => ({
          input: e.input,
          expectedOutput: e.expectedOutput,
          weight: e.weight,
        })),
      )
    : {
        score: 0,
        passed: 0,
        total: allExamples.length,
        failures: allExamples.map((e) => ({
          input: e.input,
          expected: e.expectedOutput,
          actual: null,
        })),
      };

  const previousScore = currentEval.score;

  // Build prompt for LLM
  const spec = {
    description: `Agent: ${config.baseAgent} — ${config.instanceName}`,
    inputType: 'unknown',
    outputType: 'unknown',
    examples: allExamples.map((e) => ({
      input: e.input,
      expectedOutput: e.expectedOutput,
      weight: e.weight,
    })),
    currentCode: currentCode || undefined,
    history: (config.evolutionHistory ?? []).map((e) => ({
      version: e.version,
      code: '',
      score: e.score,
      passCount: Math.round(e.score * e.examplesUsed),
      totalCount: e.examplesUsed,
      timestamp: e.timestamp,
      changelog: e.change,
    })),
  };

  const prompt = buildEvolvePrompt(spec, currentCode ? currentEval : undefined);

  // Use smart prompt (built-in AI → Ollama → throw)
  const { result: rawCode, source } = await smartPrompt(prompt, {
    systemPrompt:
      'You are an expert JavaScript developer. Write only the function body code, no explanation.',
  });

  const newCode = extractCode(rawCode);

  // Evaluate the new code
  const newEval = evaluateHeuristic(
    newCode,
    allExamples.map((e) => ({
      input: e.input,
      expectedOutput: e.expectedOutput,
      weight: e.weight,
    })),
  );

  // Only keep the new code if it's better (or if there was no previous code)
  const improved = newEval.score >= previousScore;
  const finalCode = improved ? newCode : currentCode;
  const finalScore = improved ? newEval.score : previousScore;

  // Build new evolution entry
  const version = (config.evolutionHistory?.length ?? 0) + 1;
  const entry: EvolutionEntry = {
    version,
    score: newEval.score,
    examplesUsed: allExamples.length,
    change: improved
      ? `Improved: ${(previousScore * 100).toFixed(0)}% → ${(newEval.score * 100).toFixed(0)}%`
      : `No improvement: ${(newEval.score * 100).toFixed(0)}% (kept v${version - 1})`,
    timestamp: Date.now(),
  };

  // Return updated config
  const updatedConfig: AgentConfig = {
    ...config,
    evolvedCode: finalCode,
    examples: allExamples,
    evolutionHistory: [...(config.evolutionHistory ?? []), entry],
    updatedAt: Date.now(),
    trainedOn: allExamples.length,
    accuracy: Math.round(finalScore * 100),
  };

  return {
    config: updatedConfig,
    score: finalScore,
    passed: improved ? newEval.passed : currentEval.passed,
    total: allExamples.length,
    source,
    previousScore,
  };
}
