/**
 * Chrome/Edge Built-in AI — zero download, pre-installed LLM.
 *
 * Chrome ships Gemini Nano (4GB), Edge ships Aion 1.0.
 * Both expose the same Prompt API: LanguageModel.create()
 * Plus specialized APIs: Summarizer, Translator, Writer, Rewriter.
 *
 * These run ON-DEVICE with no cloud calls, no API keys, no download.
 * Falls back to Ollama or heuristic when not available.
 */

export type BuiltInAvailability = 'available' | 'downloadable' | 'unavailable';

/** Detect if the browser has built-in AI capabilities. */
export async function detectBuiltInAI(): Promise<{
  prompt: BuiltInAvailability;
  summarizer: BuiltInAvailability;
  writer: BuiltInAvailability;
  rewriter: BuiltInAvailability;
  translator: BuiltInAvailability;
  languageDetector: BuiltInAvailability;
}> {
  const check = async (obj: any): Promise<BuiltInAvailability> => {
    if (!obj?.availability) return 'unavailable';
    try {
      const status = await obj.availability();
      if (status === 'available' || status === 'readily') return 'available';
      if (status === 'after-download' || status === 'downloadable') return 'downloadable';
      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  };

  const g = globalThis as any;
  return {
    prompt: await check(g.LanguageModel ?? g.ai?.languageModel),
    summarizer: await check(g.Summarizer ?? g.ai?.summarizer),
    writer: await check(g.Writer ?? g.ai?.writer),
    rewriter: await check(g.Rewriter ?? g.ai?.rewriter),
    translator: await check(g.Translator ?? g.ai?.translator),
    languageDetector: await check(g.LanguageDetector ?? g.ai?.languageDetector),
  };
}

/** Create a prompt session with the built-in LLM. */
export async function createPromptSession(options?: {
  systemPrompt?: string;
  temperature?: number;
  topK?: number;
}): Promise<BuiltInSession> {
  const g = globalThis as any;
  const LM = g.LanguageModel ?? g.ai?.languageModel;
  if (!LM?.create) throw new Error('Built-in AI not available in this browser');

  const session = await LM.create({
    systemPrompt: options?.systemPrompt,
    temperature: options?.temperature,
    topK: options?.topK,
  });

  return {
    async prompt(input: string): Promise<string> {
      return session.prompt(input);
    },
    async *promptStreaming(input: string): AsyncGenerator<string> {
      const stream = session.promptStreaming(input);
      for await (const chunk of stream) {
        yield chunk;
      }
    },
    destroy() {
      session.destroy?.();
    },
  };
}

export interface BuiltInSession {
  prompt(input: string): Promise<string>;
  promptStreaming(input: string): AsyncGenerator<string>;
  destroy(): void;
}

/** Create a summarizer using the built-in Summarizer API. */
export async function createSummarizer(options?: {
  type?: 'key-points' | 'tl;dr' | 'teaser' | 'headline';
  format?: 'plain-text' | 'markdown';
  length?: 'short' | 'medium' | 'long';
}): Promise<{ summarize(text: string): Promise<string> }> {
  const g = globalThis as any;
  const S = g.Summarizer ?? g.ai?.summarizer;
  if (!S?.create) throw new Error('Summarizer API not available');

  const summarizer = await S.create({
    type: options?.type ?? 'tl;dr',
    format: options?.format ?? 'markdown',
    length: options?.length ?? 'medium',
  });

  return {
    async summarize(text: string): Promise<string> {
      return summarizer.summarize(text);
    },
  };
}

/** Create a writer using the built-in Writer API. */
export async function createWriter(options?: {
  tone?: 'formal' | 'neutral' | 'casual';
  length?: 'short' | 'medium' | 'long';
}): Promise<{ write(task: string): Promise<string> }> {
  const g = globalThis as any;
  const W = g.Writer ?? g.ai?.writer;
  if (!W?.create) throw new Error('Writer API not available');

  const writer = await W.create({
    tone: options?.tone ?? 'neutral',
    length: options?.length ?? 'medium',
  });

  return {
    async write(task: string): Promise<string> {
      return writer.write(task);
    },
  };
}

/** Create a rewriter using the built-in Rewriter API. */
export async function createRewriter(options?: {
  tone?: 'as-is' | 'more-formal' | 'more-casual';
}): Promise<{ rewrite(text: string, context?: string): Promise<string> }> {
  const g = globalThis as any;
  const R = g.Rewriter ?? g.ai?.rewriter;
  if (!R?.create) throw new Error('Rewriter API not available');

  const rewriter = await R.create({
    tone: options?.tone ?? 'as-is',
  });

  return {
    async rewrite(text: string, context?: string): Promise<string> {
      return rewriter.rewrite(text, { context });
    },
  };
}

/** Create a translator using the built-in Translator API. */
export async function createTranslator(
  sourceLanguage: string,
  targetLanguage: string,
): Promise<{ translate(text: string): Promise<string> }> {
  const g = globalThis as any;
  const T = g.Translator ?? g.ai?.translator;
  if (!T?.create) throw new Error('Translator API not available');

  const translator = await T.create({ sourceLanguage, targetLanguage });

  return {
    async translate(text: string): Promise<string> {
      return translator.translate(text);
    },
  };
}

/**
 * Smart fallback chain: built-in AI → Ollama → heuristic.
 * Tries the best available option automatically.
 */
export async function smartPrompt(
  input: string,
  options?: {
    systemPrompt?: string;
    ollamaModel?: string;
    heuristicFallback?: (input: string) => string;
  },
): Promise<{ result: string; source: 'built-in' | 'ollama' | 'heuristic' }> {
  // Tier 1: Built-in AI
  try {
    const status = await detectBuiltInAI();
    if (status.prompt === 'available') {
      const session = await createPromptSession({ systemPrompt: options?.systemPrompt });
      const result = await session.prompt(input);
      session.destroy();
      return { result, source: 'built-in' };
    }
  } catch {}

  // Tier 2: Ollama
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const genRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options?.ollamaModel ?? 'llama3.2',
          prompt: options?.systemPrompt ? `${options.systemPrompt}\n\n${input}` : input,
          stream: false,
        }),
      });
      const data = await genRes.json();
      return { result: data.response, source: 'ollama' };
    }
  } catch {}

  // Tier 3: Heuristic fallback
  if (options?.heuristicFallback) {
    return { result: options.heuristicFallback(input), source: 'heuristic' };
  }

  throw new Error(
    'No AI available: built-in AI not supported, Ollama not running, no heuristic fallback provided',
  );
}
