/**
 * AGENTNAME — Extractor Heuristic
 *
 * Extracts structured data from HTML/text by matching patterns,
 * attributes, and contextual signals. Generated via LLM evolution.
 *
 * Replace the rules below with your own extraction patterns.
 */

export interface ExtractedField {
  role: string;
  value?: string;
  selector: string;
  confidence: number; // 0-1
  evidence: string[];
}

export interface ExtractionResult {
  fields: ExtractedField[];
  metadata: Record<string, unknown>;
}

// --- Define your extraction rules here ---
// [pattern to match against tag, role name, confidence]
const RULES: [RegExp, string, number][] = [
  // Example rules — replace with your own:
  // [/type\s*=\s*["']email["']/i, 'email', 0.95],
  // [/name\s*=\s*["']password["']/i, 'password', 0.9],
];

export function extract(html: string): ExtractionResult {
  const fields: ExtractedField[] = [];

  // Extract input/textarea/select elements
  const tagPattern = /<(input|textarea|select)(?:\s[^>]*)?\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[0];

    // Skip hidden/submit
    if (/type\s*=\s*["'](hidden|submit|button|reset)["']/i.test(tag)) continue;

    let bestRole = 'unknown';
    let bestConfidence = 0;
    const evidence: string[] = [];

    for (const [pattern, role, confidence] of RULES) {
      if (pattern.test(tag)) {
        if (confidence > bestConfidence) {
          bestRole = role;
          bestConfidence = confidence;
        }
        evidence.push(`rule:${role}`);
      }
    }

    if (bestRole !== 'unknown') {
      const id = tag.match(/id\s*=\s*["']([^"']+)["']/i);
      const name = tag.match(/name\s*=\s*["']([^"']+)["']/i);
      const selector = id ? `#${id[1]}` : name ? `[name="${name[1]}"]` : 'input';

      fields.push({
        role: bestRole,
        selector,
        confidence: Math.round(bestConfidence * 100) / 100,
        evidence,
      });
    }
  }

  return { fields, metadata: { fieldCount: fields.length } };
}
