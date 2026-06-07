import { useCallback, useEffect, useRef, useState } from 'react';
import { OllamaClient } from '../ollama.js';
import type { OllamaStatus } from '../types.js';

/**
 * React hook for detecting and using local Ollama.
 *
 * Usage:
 * ```tsx
 * const { available, models, chat } = useOllama();
 *
 * if (available) {
 *   const stream = chat('llama3.2', [{ role: 'user', content: 'Hello!' }]);
 *   for await (const chunk of stream) { ... }
 * }
 * ```
 */
export function useOllama(endpoint?: string) {
  const [status, setStatus] = useState<OllamaStatus>({
    available: false,
    models: [],
    endpoint: endpoint ?? 'http://localhost:11434',
  });
  const clientRef = useRef(new OllamaClient(endpoint));

  useEffect(() => {
    clientRef.current.detect().then(setStatus);
  }, []);

  const chat = useCallback((model: string, messages: { role: string; content: string }[]) => {
    return clientRef.current.chat(model, messages);
  }, []);

  const generate = useCallback((model: string, prompt: string) => {
    return clientRef.current.generate(model, prompt);
  }, []);

  const refresh = useCallback(async () => {
    const s = await clientRef.current.detect();
    setStatus(s);
    return s;
  }, []);

  return {
    ...status,
    chat,
    generate,
    refresh,
  };
}
