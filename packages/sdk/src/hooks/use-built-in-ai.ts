import { useCallback, useEffect, useState } from 'react';
import type { BuiltInAvailability, BuiltInSession } from '../built-in-ai.js';
import { createPromptSession, detectBuiltInAI, smartPrompt } from '../built-in-ai.js';

/**
 * Detect built-in AI capabilities in the current browser.
 */
export function useBuiltInAI() {
  const [capabilities, setCapabilities] = useState<Record<string, BuiltInAvailability>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    detectBuiltInAI().then((caps) => {
      setCapabilities(caps);
      setLoading(false);
    });
  }, []);

  const hasPrompt = capabilities.prompt === 'available';
  const hasSummarizer = capabilities.summarizer === 'available';
  const hasWriter = capabilities.writer === 'available';
  const hasTranslator = capabilities.translator === 'available';
  const hasAny = hasPrompt || hasSummarizer || hasWriter || hasTranslator;

  return { capabilities, loading, hasPrompt, hasSummarizer, hasWriter, hasTranslator, hasAny };
}

/**
 * Use the built-in Prompt API for free-form LLM prompting.
 */
export function usePrompt(systemPrompt?: string) {
  const [session, setSession] = useState<BuiltInSession | null>(null);
  const [available, setAvailable] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    detectBuiltInAI().then((caps) => setAvailable(caps.prompt === 'available'));
  }, []);

  const init = useCallback(async () => {
    const s = await createPromptSession({ systemPrompt });
    setSession(s);
    return s;
  }, [systemPrompt]);

  const prompt = useCallback(
    async (input: string): Promise<string> => {
      setGenerating(true);
      try {
        const s = session ?? (await init());
        return await s.prompt(input);
      } finally {
        setGenerating(false);
      }
    },
    [session, init],
  );

  return { available, generating, prompt, init, session };
}

/**
 * Smart prompt with automatic fallback: built-in → Ollama → heuristic.
 */
export function useSmartPrompt(options?: {
  systemPrompt?: string;
  ollamaModel?: string;
  heuristicFallback?: (input: string) => string;
}) {
  const [generating, setGenerating] = useState(false);
  const [lastSource, setLastSource] = useState<'built-in' | 'ollama' | 'heuristic' | null>(null);

  const prompt = useCallback(
    async (input: string): Promise<string> => {
      setGenerating(true);
      try {
        const { result, source } = await smartPrompt(input, options);
        setLastSource(source);
        return result;
      } finally {
        setGenerating(false);
      }
    },
    [options],
  );

  return { prompt, generating, lastSource };
}
