/**
 * LangChain.js integration for FreeBioStore agents.
 * Wraps LangChain with FAGS proxy for API key injection.
 *
 * Usage:
 *   import { createFagsChat, createFagsEmbeddings } from '@freebiostore/sdk/langchain'
 *   const chat = createFagsChat({ provider: 'openai', model: 'gpt-4o-mini' })
 *   const response = await chat.invoke([{ role: 'user', content: 'Hello' }])
 */

export interface FagsChatOptions {
  provider: 'openai' | 'anthropic' | 'google' | 'groq';
  model: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

// Map provider to proxy base URL
const PROVIDER_HOSTS: Record<string, string> = {
  openai: 'api.openai.com',
  anthropic: 'api.anthropic.com',
  google: 'generativelanguage.googleapis.com',
  groq: 'api.groq.com',
};

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('fags_session');
    if (stored) {
      const p = JSON.parse(stored);
      return p?.token ?? null;
    }
  } catch {}
  return null;
}

/**
 * Create a chat model that routes through the FAGS proxy.
 * The proxy injects the user's API key server-side.
 *
 * This returns a plain fetch-based wrapper (no LangChain dependency).
 * For LangChain, use getFagsLangChainConfig() instead.
 */
export function createFagsChat(options: FagsChatOptions) {
  const host = PROVIDER_HOSTS[options.provider];
  if (!host) throw new Error(`Unknown provider: ${options.provider}`);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://freebiostore.online';
  const proxyBase = `${origin}/v1/proxy/${host}`;

  return {
    async invoke(messages: Array<{ role: string; content: string }>): Promise<string> {
      const token = getToken();
      if (!token) throw new Error('Not signed in. Call fags.keys.manage() first.');

      const res = await fetch(`${proxyBase}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error?.message ?? err.error ?? `API error ${res.status}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    },

    async *stream(messages: Array<{ role: string; content: string }>): AsyncGenerator<string> {
      const token = getToken();
      if (!token) throw new Error('Not signed in.');

      const res = await fetch(`${proxyBase}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          stream: true,
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const json = JSON.parse(line.slice(6));
              const t = json.choices?.[0]?.delta?.content;
              if (t) yield t;
            } catch {}
          }
        }
      }
    },

    proxyBaseUrl: proxyBase,
    provider: options.provider,
    model: options.model,
  };
}

/**
 * Configuration for using LangChain.js with FAGS proxy.
 * Returns the config object to pass to LangChain's ChatOpenAI constructor.
 *
 * Usage with LangChain:
 *   import { ChatOpenAI } from '@langchain/openai'
 *   import { getFagsLangChainConfig } from '@freebiostore/sdk/langchain'
 *   const chat = new ChatOpenAI(getFagsLangChainConfig('gpt-4o-mini'))
 */
export function getFagsLangChainConfig(model: string, provider = 'openai') {
  const host = PROVIDER_HOSTS[provider] ?? PROVIDER_HOSTS.openai;
  const token = getToken();

  return {
    modelName: model,
    temperature: 0.7,
    configuration: {
      baseURL: `${typeof window !== 'undefined' ? window.location.origin : 'https://freebiostore.online'}/v1/proxy/${host}/v1`,
      defaultHeaders: { Authorization: `Bearer ${token}` },
    },
    // LangChain needs an API key param even though proxy injects it
    openAIApiKey: 'fags-proxy-managed',
  };
}
