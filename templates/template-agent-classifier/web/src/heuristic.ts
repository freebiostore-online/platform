/**
 * AGENTNAME — Classifier Heuristic
 *
 * Classifies input by scoring weighted signals.
 * Generated via LLM evolution, runs at zero cost.
 *
 * Replace the signals below with your own detection patterns.
 */

export interface ClassifierResult {
  match: boolean;
  confidence: number; // 0-1
  signals: Signal[];
}

export interface Signal {
  name: string;
  weight: number;
  found: boolean;
  detail?: string;
}

const THRESHOLD = 0.4;

export function classify(input: string): ClassifierResult {
  const signals: Signal[] = [];

  // --- Add your signals here ---
  // Positive signals (evidence FOR the classification)
  // signals.push({ name: 'signal-name', weight: 2, found: /pattern/.test(input) });

  // Negative signals (evidence AGAINST)
  // signals.push({ name: 'counter-signal', weight: -2, found: /other/.test(input) });

  // Example: detect if input contains a keyword
  const hasKeyword = /your-keyword/i.test(input);
  signals.push({ name: 'keyword-present', weight: 2, found: hasKeyword });

  // --- Score calculation ---
  let score = 0;
  let maxPositive = 0;
  for (const s of signals) {
    if (s.found) score += s.weight;
    if (s.weight > 0) maxPositive += s.weight;
  }

  const confidence = maxPositive > 0
    ? Math.max(0, Math.min(1, score / (maxPositive * 0.6)))
    : 0;

  return {
    match: confidence >= THRESHOLD,
    confidence: Math.round(confidence * 100) / 100,
    signals,
  };
}
