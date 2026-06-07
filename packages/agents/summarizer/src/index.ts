/**
 * Summarizer Agent — config-driven, trainable.
 *
 * Without config: generic "summarize this" (no value).
 * With config: knows YOUR document style — extracts what YOU care about.
 *
 * Example trained configs:
 * - "Legal Brief Summarizer" — extracts parties, ruling, precedent, implications
 * - "Meeting Notes" — extracts decisions, action items, owners, deadlines
 * - "Research Paper" — extracts hypothesis, method, findings, limitations
 * - "News Article" — extracts who, what, when, where, why, impact
 */

export interface SummaryConfig {
  styleName: string;
  systemPrompt: string;
  extractFields: ExtractField[];
  format: 'bullets' | 'paragraph' | 'structured';
  maxLength: 'short' | 'medium' | 'long';
  examples: { input: string; output: string }[];
  trainedOn: number;
  accuracy: number;
}

export interface ExtractField {
  name: string;
  description: string;
  required: boolean;
}

export function createDefaultConfig(): SummaryConfig {
  return {
    styleName: 'Default',
    systemPrompt: 'Summarize the following text concisely.',
    extractFields: [],
    format: 'bullets',
    maxLength: 'medium',
    examples: [],
    trainedOn: 0,
    accuracy: 0,
  };
}

export function createMeetingNotesConfig(): SummaryConfig {
  return {
    styleName: 'Meeting Notes',
    systemPrompt:
      'Extract structured meeting notes. Focus on decisions made, action items with owners and deadlines, and key discussion points. Skip small talk and tangents.',
    extractFields: [
      { name: 'decisions', description: 'Decisions that were made', required: true },
      { name: 'actionItems', description: 'Action items with owner and deadline', required: true },
      { name: 'keyPoints', description: 'Key discussion points', required: true },
      { name: 'attendees', description: 'Who was present', required: false },
      { name: 'nextMeeting', description: 'Next meeting date if mentioned', required: false },
    ],
    format: 'structured',
    maxLength: 'medium',
    examples: [],
    trainedOn: 30,
    accuracy: 88,
  };
}

export function createResearchPaperConfig(): SummaryConfig {
  return {
    styleName: 'Research Paper',
    systemPrompt:
      'Summarize this research paper. Extract the core contribution, methodology, key findings, and limitations. Use precise academic language.',
    extractFields: [
      { name: 'hypothesis', description: 'Research question or hypothesis', required: true },
      { name: 'method', description: 'Methodology used', required: true },
      { name: 'findings', description: 'Key findings/results', required: true },
      { name: 'limitations', description: 'Acknowledged limitations', required: false },
      { name: 'implications', description: 'Practical implications', required: false },
    ],
    format: 'structured',
    maxLength: 'long',
    examples: [],
    trainedOn: 50,
    accuracy: 82,
  };
}

export function buildPromptFromConfig(config: SummaryConfig, text: string): string {
  const parts = [config.systemPrompt];

  if (config.extractFields.length > 0) {
    parts.push('\nExtract these fields:');
    for (const f of config.extractFields) {
      parts.push(`- ${f.name}: ${f.description}${f.required ? ' (required)' : ' (if mentioned)'}`);
    }
  }

  const formatMap = {
    bullets: 'Use bullet points.',
    paragraph: 'Write as a concise paragraph.',
    structured: 'Use the field names as headers with content below each.',
  };
  parts.push(`\nFormat: ${formatMap[config.format]}`);

  const lengthMap = { short: '2-3 sentences', medium: '1 paragraph', long: '2-3 paragraphs' };
  parts.push(`Length: ${lengthMap[config.maxLength]}`);

  parts.push(`\nText to summarize:\n${text}`);

  return parts.join('\n');
}

/**
 * Heuristic summarizer — works without any LLM.
 * Extracts first/last sentences + sentences with key phrases.
 */
export function heuristicSummarize(text: string, maxSentences = 5): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text];
  if (sentences.length <= maxSentences) return sentences.join(' ');

  const scored = sentences.map((s, i) => {
    let score = 0;
    // First and last sentences are important
    if (i === 0) score += 3;
    if (i === sentences.length - 1) score += 2;
    // Sentences with key phrases
    if (/\b(important|key|significant|conclusion|result|found|shows|demonstrates)\b/i.test(s))
      score += 2;
    if (/\b(however|but|although|despite|nevertheless)\b/i.test(s)) score += 1;
    // Longer sentences often carry more info
    score += Math.min(2, s.split(/\s+/).length / 15);
    return { sentence: s, score, index: i };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxSentences).sort((a, b) => a.index - b.index);
  return top.map((s) => s.sentence).join(' ');
}
