/**
 * Heuristic Trainer for the Extension
 *
 * Takes recorded actions + test cases (including failure cases) and
 * generates resilient heuristic code that can find elements on
 * similar pages without an LLM.
 *
 * AI priority: Chrome Built-in AI → Ollama → manual fallback.
 *
 * The generated code is a function body that receives (document, action, stepIndex)
 * and returns an Element or CSS selector string.
 */

import type { Automation, TestCase } from './types';

export interface TrainResult {
  code: string;
  score: number;
  passed: number;
  total: number;
  source: 'built-in' | 'ollama' | 'openai' | 'manual';
}

/**
 * Train/improve heuristic code for an automation.
 */
export async function train(
  automation: Automation,
  onStatus?: (msg: string) => void,
): Promise<TrainResult> {
  const prompt = buildTrainPrompt(automation);

  onStatus?.('Generating heuristic...');
  const raw = await getAIResponse(prompt, onStatus);
  const code = extractCode(raw);

  // Evaluate against test cases
  const { score, passed, total } = evaluateHeuristic(code, automation.testCases);

  return {
    code,
    score,
    passed,
    total,
    source: 'built-in', // TODO: track actual source
  };
}

/**
 * Build the training prompt from automation data.
 */
function buildTrainPrompt(auto: Automation): string {
  const parts: string[] = [];

  parts.push(`# Browser Automation Heuristic Generator\n`);
  parts.push(`## Task`);
  parts.push(
    `Generate a JavaScript function body that finds the right DOM element for each step of a browser automation.`,
  );
  parts.push(
    `The function receives: \`document\` (the DOM), \`action\` (the recorded action object), \`stepIndex\` (0-based step number).`,
  );
  parts.push(`It must return a DOM Element or a CSS selector string.\n`);

  parts.push(`## Automation: "${auto.name}"`);
  parts.push(`Site: ${auto.site}`);
  parts.push(`URL pattern: ${auto.urlPattern}\n`);

  parts.push(`## Recorded Steps (${auto.actions.length}):`);
  for (let i = 0; i < auto.actions.length; i++) {
    const a = auto.actions[i];
    const selectors = a.selectors.map((s) => `${s.tier}:${s.value}`).join(', ');
    parts.push(
      `${i}. ${a.label} [${a.type}] selectors=[${selectors}]${a.value ? ` value="${a.value}"` : ''}`,
    );
  }

  if (auto.testCases.length > 0) {
    parts.push(`\n## Test Cases (${auto.testCases.length}):`);
    for (const tc of auto.testCases.slice(0, 10)) {
      const htmlPreview = tc.html.slice(0, 500).replace(/\n/g, ' ');
      parts.push(`- URL: ${tc.url}`);
      parts.push(
        `  Expected: ${tc.expectedAction.type} on "${tc.expectedAction.selector}"${tc.expectedAction.value ? ` = "${tc.expectedAction.value}"` : ''}`,
      );
      parts.push(`  HTML preview: ${htmlPreview}`);
      if (tc.isFailureCase)
        parts.push(
          `  ** This is a FAILURE CASE — the previous heuristic couldn't find this element **`,
        );
    }
  }

  if (auto.heuristicCode) {
    parts.push(`\n## Current Code (to improve):`);
    parts.push('```javascript');
    parts.push(auto.heuristicCode);
    parts.push('```');
  }

  parts.push(`\n## Rules`);
  parts.push(`- Use \`document.querySelector\` and DOM traversal. No external libs.`);
  parts.push(`- Use \`action.selectors\` array to try multiple strategies.`);
  parts.push(`- For each step, first try the recorded selectors in order.`);
  parts.push(
    `- If none match, use heuristic fallbacks: find by label text, placeholder, nearby heading, form structure.`,
  );
  parts.push(
    `- Make the code RESILIENT to minor page changes (class renames, reordering, extra wrappers).`,
  );
  parts.push(`- Return the Element directly, or a CSS selector string.`);
  parts.push(`- Handle step-specific logic with \`if (stepIndex === N)\` blocks.`);
  parts.push(`- Return ONLY the function body code. No function wrapper, no explanation.`);

  return parts.join('\n');
}

/**
 * Evaluate heuristic code against test cases.
 * Runs in a simulated DOM context (using DOMParser).
 */
function evaluateHeuristic(
  code: string,
  testCases: TestCase[],
): { score: number; passed: number; total: number } {
  if (testCases.length === 0) return { score: 1, passed: 0, total: 0 };

  let passed = 0;

  for (const tc of testCases) {
    try {
      // Parse the HTML into a document
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<html><body>${tc.html}</body></html>`, 'text/html');

      // Create a mock action object
      const mockAction = {
        type: tc.expectedAction.type,
        selectors: [{ tier: 'css', value: tc.expectedAction.selector, confidence: 1 }],
        value: tc.expectedAction.value,
      };

      // Run the heuristic
      const fn = new Function('document', 'action', 'stepIndex', code);
      const result = fn(doc, mockAction, 0);

      // Check if it found the right element
      let found: Element | null = null;
      if (result instanceof Element) {
        found = result;
      } else if (typeof result === 'string') {
        found = doc.querySelector(result);
      }

      if (found) {
        // Verify it matches the expected selector
        const expected = doc.querySelector(tc.expectedAction.selector);
        if (
          found === expected ||
          (expected && found.contains(expected)) ||
          expected?.contains(found)
        ) {
          passed++;
        }
      }
    } catch {
      // Test case failed — heuristic threw
    }
  }

  return {
    score: testCases.length > 0 ? passed / testCases.length : 0,
    passed,
    total: testCases.length,
  };
}

/**
 * Get AI response — tries Built-in AI, then Ollama.
 */
async function getAIResponse(prompt: string, onStatus?: (msg: string) => void): Promise<string> {
  // Tier 1: Chrome Built-in AI
  try {
    const g = globalThis as any;
    const LM = g.LanguageModel ?? g.ai?.languageModel;
    if (LM?.create) {
      const avail = await LM.availability?.();
      if (avail === 'available' || avail === 'readily') {
        onStatus?.('Using Chrome Built-in AI...');
        const session = await LM.create({
          systemPrompt:
            'You write resilient browser automation code. Return only the function body, no explanation.',
        });
        const result = await session.prompt(prompt);
        session.destroy?.();
        return result;
      }
    }
  } catch {
    /* fall through */
  }

  // Tier 2: Ollama
  try {
    onStatus?.('Trying Ollama...');
    const check = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    });
    if (check.ok) {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          system:
            'You write resilient browser automation code. Return only the function body, no explanation.',
          prompt,
          stream: false,
        }),
      });
      const data = await res.json();
      return data.response;
    }
  } catch {
    /* fall through */
  }

  // Tier 3: Generate basic fallback code
  onStatus?.('No AI available — generating basic selector fallback...');
  return generateFallbackCode();
}

/**
 * When no AI is available, generate basic code that tries selectors in order.
 */
function generateFallbackCode(): string {
  return `
// Auto-generated fallback: try selectors in order
for (const s of action.selectors) {
  try {
    if (s.tier === 'text') {
      const text = s.value.slice(5).toLowerCase();
      for (const el of document.querySelectorAll('button, a, [role="button"]')) {
        if (el.textContent?.trim().toLowerCase().includes(text)) return el;
      }
    } else if (s.tier === 'label') {
      const labelText = s.value.slice(11).toLowerCase();
      for (const label of document.querySelectorAll('label')) {
        if (label.textContent?.trim().toLowerCase().includes(labelText)) {
          const forId = label.getAttribute('for');
          if (forId) { const el = document.getElementById(forId); if (el) return el; }
          const input = label.querySelector('input, textarea, select');
          if (input) return input;
        }
      }
    } else {
      const el = document.querySelector(s.value);
      if (el) return el;
    }
  } catch {}
}
return null;
  `.trim();
}

function extractCode(response: string): string {
  const fence = response.match(/```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)\n```/);
  if (fence) return fence[1].trim();
  return response.trim();
}
