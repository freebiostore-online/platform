import type { OllamaStatus } from './types.js';

const DEFAULT_ENDPOINT = 'http://localhost:11434';
const DETECT_TIMEOUT = 2000;

/**
 * Detects and communicates with a local Ollama instance.
 * Ollama is optional — agents must work without it.
 */
export class OllamaClient {
  private endpoint: string;
  private _status: OllamaStatus = { available: false, models: [], endpoint: DEFAULT_ENDPOINT };

  constructor(endpoint?: string) {
    this.endpoint = endpoint ?? DEFAULT_ENDPOINT;
    this._status.endpoint = this.endpoint;
  }

  get status() {
    return this._status;
  }

  /** Detect if Ollama is running locally. */
  async detect(): Promise<OllamaStatus> {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(DETECT_TIMEOUT),
      });
      if (!res.ok) {
        this._status = { available: false, models: [], endpoint: this.endpoint };
        return this._status;
      }
      const { models } = (await res.json()) as { models: OllamaRawModel[] };
      this._status = {
        available: true,
        endpoint: this.endpoint,
        models: models.map((m) => ({
          name: m.name,
          size: m.size,
          parameterSize: m.details?.parameter_size ?? 'unknown',
          quantization: m.details?.quantization_level ?? 'unknown',
        })),
      };
      return this._status;
    } catch {
      this._status = { available: false, models: [], endpoint: this.endpoint };
      return this._status;
    }
  }

  /** Chat completion (OpenAI-compatible API). Returns an async generator for streaming. */
  async *chat(
    model: string,
    messages: { role: string; content: string }[],
    options?: { temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string> {
    const res = await fetch(`${this.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Ollama chat failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const json = JSON.parse(line.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip malformed SSE
        }
      }
    }
  }

  /** Simple generate (non-streaming). */
  async generate(model: string, prompt: string): Promise<string> {
    const res = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama generate failed: ${res.status}`);
    const data = await res.json();
    return data.response;
  }
}

interface OllamaRawModel {
  name: string;
  size: number;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
  };
}
