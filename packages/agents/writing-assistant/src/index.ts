/**
 * Writing Assistant Agent — config-driven, trainable.
 *
 * WITHOUT a trained config: generic LLM wrapper (no value).
 * WITH a trained config: knows your style, tone, formatting.
 *
 * The config is evolved in the Console from YOUR examples:
 *   1. Upload 50 of your company emails
 *   2. Console + built-in AI extracts patterns (tone, length, greetings, signatures)
 *   3. Config captures those patterns as rules
 *   4. Agent applies rules consistently — better than raw LLM
 *
 * The value is determinism + consistency. The LLM generates, but the
 * config constrains it to YOUR style every time.
 */

export interface WritingConfig {
  /** Name of this writing style. */
  styleName: string;
  /** Core system prompt evolved from examples. */
  systemPrompt: string;
  /** Tone rules extracted from training data. */
  toneRules: ToneRule[];
  /** Formatting patterns (greeting, sign-off, paragraph length, etc.) */
  formatting: FormattingRules;
  /** Example pairs used to train this config. */
  examples: WritingExample[];
  /** How many examples this was trained on. */
  trainedOn: number;
  /** Consistency score (how well the LLM matches the style). */
  consistency: number;
}

export interface ToneRule {
  /** What this rule controls. */
  aspect: 'formality' | 'warmth' | 'directness' | 'humor' | 'length';
  /** Value from 0-10. */
  value: number;
  /** Natural language description. */
  description: string;
}

export interface FormattingRules {
  greeting?: string;
  signOff?: string;
  maxParagraphs?: number;
  avgSentenceLength?: 'short' | 'medium' | 'long';
  useBulletPoints?: boolean;
  includeSubjectLine?: boolean;
  customRules?: string[];
}

export interface WritingExample {
  input: string;
  output: string;
  type: 'email' | 'blog' | 'social' | 'reply' | 'other';
}

/**
 * Build a system prompt from a trained config.
 * This is what makes the agent valuable — not just "write an email"
 * but "write an email in THIS specific style with THESE patterns."
 */
export function buildPromptFromConfig(config: WritingConfig, task: string): string {
  const parts: string[] = [];

  parts.push(config.systemPrompt);

  if (config.toneRules.length > 0) {
    parts.push('\nTone guidelines:');
    for (const rule of config.toneRules) {
      parts.push(`- ${rule.aspect}: ${rule.description} (${rule.value}/10)`);
    }
  }

  if (config.formatting.greeting) {
    parts.push(`\nAlways start with: "${config.formatting.greeting}"`);
  }
  if (config.formatting.signOff) {
    parts.push(`Always end with: "${config.formatting.signOff}"`);
  }
  if (config.formatting.maxParagraphs) {
    parts.push(`Keep to ${config.formatting.maxParagraphs} paragraphs max.`);
  }
  if (config.formatting.avgSentenceLength) {
    const len = { short: '10-15 words', medium: '15-25 words', long: '25-35 words' };
    parts.push(`Aim for ${len[config.formatting.avgSentenceLength]} per sentence.`);
  }
  if (config.formatting.useBulletPoints) {
    parts.push('Use bullet points for lists.');
  }
  if (config.formatting.includeSubjectLine) {
    parts.push('Include a subject line on the first line.');
  }
  if (config.formatting.customRules?.length) {
    parts.push('\nAdditional rules:');
    for (const rule of config.formatting.customRules) {
      parts.push(`- ${rule}`);
    }
  }

  parts.push(`\nTask: ${task}`);

  return parts.join('\n');
}

/**
 * Analyze training examples to extract style patterns.
 * This runs WITHOUT an LLM — pure heuristic analysis.
 */
export function analyzeStyle(examples: WritingExample[]): Partial<WritingConfig> {
  if (examples.length === 0) return {};

  const outputs = examples.map((e) => e.output);

  // Analyze sentence length
  const allSentences = outputs.flatMap((o) => o.match(/[^.!?]+[.!?]+/g) ?? []);
  const avgWords =
    allSentences.length > 0
      ? allSentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / allSentences.length
      : 15;
  const avgSentenceLength: 'short' | 'medium' | 'long' =
    avgWords < 15 ? 'short' : avgWords < 25 ? 'medium' : 'long';

  // Detect common greetings
  const firstLines = outputs.map((o) => o.split('\n')[0].trim());
  const greetings = firstLines.filter((l) => /^(hi|hey|hello|dear|good|thanks)/i.test(l));
  const greeting = greetings.length > outputs.length / 2 ? mostCommon(greetings) : undefined;

  // Detect common sign-offs
  const lastLines = outputs.map((o) => o.trim().split('\n').pop()?.trim() ?? '');
  const signOffs = lastLines.filter((l) => /^(best|regards|thanks|cheers|sincerely|warm)/i.test(l));
  const signOff = signOffs.length > outputs.length / 2 ? mostCommon(signOffs) : undefined;

  // Detect paragraph count
  const paragraphCounts = outputs.map((o) => o.split(/\n\s*\n/).length);
  const avgParagraphs = Math.round(
    paragraphCounts.reduce((a, b) => a + b, 0) / paragraphCounts.length,
  );

  // Detect bullet points usage
  const useBulletPoints =
    outputs.filter((o) => /^[\s]*[-•*]\s/m.test(o)).length > outputs.length / 3;

  // Detect formality (simple heuristic)
  const formalWords = [
    'sincerely',
    'regards',
    'dear',
    'hereby',
    'pursuant',
    'accordingly',
    'furthermore',
  ];
  const casualWords = ['hey', 'cool', 'awesome', 'gonna', 'wanna', 'lol', 'btw', 'fyi'];
  const allText = outputs.join(' ').toLowerCase();
  const formalCount = formalWords.filter((w) => allText.includes(w)).length;
  const casualCount = casualWords.filter((w) => allText.includes(w)).length;
  const formality = Math.min(10, Math.max(0, 5 + formalCount - casualCount));

  // Detect directness (short = direct)
  const directness = avgWords < 12 ? 8 : avgWords < 18 ? 6 : avgWords < 25 ? 4 : 2;

  return {
    toneRules: [
      {
        aspect: 'formality',
        value: formality,
        description:
          formality > 6
            ? 'Formal, professional'
            : formality > 3
              ? 'Balanced, professional-casual'
              : 'Casual, conversational',
      },
      {
        aspect: 'directness',
        value: directness,
        description: directness > 6 ? 'Direct, to the point' : 'Detailed, thorough',
      },
      {
        aspect: 'length',
        value: avgParagraphs <= 2 ? 8 : avgParagraphs <= 4 ? 5 : 3,
        description: `Typically ${avgParagraphs} paragraph(s)`,
      },
    ],
    formatting: {
      greeting,
      signOff,
      maxParagraphs: avgParagraphs + 1,
      avgSentenceLength,
      useBulletPoints,
      includeSubjectLine: examples.some((e) => e.type === 'email'),
    },
    trainedOn: examples.length,
  };
}

/**
 * Create a default (untrained) config. This is the generic version.
 */
export function createDefaultConfig(): WritingConfig {
  return {
    styleName: 'Default',
    systemPrompt: 'You are a helpful writing assistant. Write clear, well-structured text.',
    toneRules: [],
    formatting: {},
    examples: [],
    trainedOn: 0,
    consistency: 0,
  };
}

/**
 * Build the LLM prompt for evolving a system prompt from examples.
 * Used by the Console training UI.
 */
export function buildTrainingPrompt(
  examples: WritingExample[],
  currentConfig?: WritingConfig,
): string {
  const parts = [
    "Analyze these writing examples and create a system prompt that captures the author's style.",
    'Focus on: tone, formality, sentence structure, common phrases, greeting/sign-off patterns.',
    '',
    `Examples (${examples.length}):`,
  ];

  for (const ex of examples.slice(0, 20)) {
    parts.push(`--- ${ex.type} ---`);
    parts.push(`Input: ${ex.input}`);
    parts.push(`Output: ${ex.output.slice(0, 500)}`);
    parts.push('');
  }

  if (currentConfig?.systemPrompt) {
    parts.push(`Current system prompt (improve it): ${currentConfig.systemPrompt}`);
  }

  parts.push('');
  parts.push('Write a detailed system prompt that will make an LLM write in exactly this style.');
  parts.push('Return ONLY the system prompt text, no explanation.');

  return parts.join('\n');
}

function mostCommon(arr: string[]): string {
  const counts = new Map<string, number>();
  for (const s of arr) counts.set(s, (counts.get(s) ?? 0) + 1);
  let best = arr[0];
  let max = 0;
  for (const [k, v] of counts)
    if (v > max) {
      best = k;
      max = v;
    }
  return best;
}
