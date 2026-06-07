/**
 * AGENTNAME — uses Chrome Built-in AI (Gemini Nano) with heuristic fallback.
 *
 * Priority chain:
 * 1. Chrome Built-in AI (LanguageModel API) — zero download, on-device
 * 2. Ollama (localhost:11434) — local LLM, user-installed
 * 3. Heuristic fallback — pure JS, always works
 */

export interface AgentResult {
  output: string;
  source: 'chrome-ai' | 'ollama' | 'heuristic';
}

/** Try Chrome Built-in AI (Gemini Nano). Returns null if unavailable. */
async function tryBuiltInAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const g = globalThis as any;
    const LM = g.LanguageModel ?? g.ai?.languageModel;
    if (!LM?.create) return null;
    const session = await LM.create({ systemPrompt });
    const result = await session.prompt(userPrompt);
    session.destroy?.();
    return result;
  } catch {
    return null;
  }
}

/** Try Ollama on localhost. Returns null if unavailable. */
async function tryOllama(prompt: string, model = 'llama3.2'): Promise<string | null> {
  try {
    const r = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!r.ok) return null;
    return (await r.json()).response;
  } catch {
    return null;
  }
}

/** Heuristic fallback — always works. Override this with your logic. */
function heuristicFallback(input: string): string {
  // TODO: Replace with your heuristic logic
  return `Processed: ${input.slice(0, 100)}`;
}

/** Main agent function — cascades through AI sources. */
export async function run(input: string): Promise<AgentResult> {
  const systemPrompt = 'You are a helpful assistant. DESCRIPTION';
  const userPrompt = input;

  const chromeResult = await tryBuiltInAI(systemPrompt, userPrompt);
  if (chromeResult) return { output: chromeResult, source: 'chrome-ai' };

  const ollamaResult = await tryOllama(`${systemPrompt}\n\n${userPrompt}`);
  if (ollamaResult) return { output: ollamaResult, source: 'ollama' };

  return { output: heuristicFallback(input), source: 'heuristic' };
}
