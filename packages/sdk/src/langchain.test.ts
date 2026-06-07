import { describe, expect, it } from 'vitest';
import { createFagsChat, getFagsLangChainConfig } from './langchain';

describe('createFagsChat', () => {
  it('creates a chat instance for openai', () => {
    const chat = createFagsChat({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(chat.provider).toBe('openai');
    expect(chat.model).toBe('gpt-4o-mini');
    expect(chat.proxyBaseUrl).toContain('/v1/proxy/api.openai.com');
  });

  it('creates a chat instance for anthropic', () => {
    const chat = createFagsChat({ provider: 'anthropic', model: 'claude-3-haiku-20240307' });
    expect(chat.provider).toBe('anthropic');
    expect(chat.proxyBaseUrl).toContain('/v1/proxy/api.anthropic.com');
  });

  it('creates a chat instance for google', () => {
    const chat = createFagsChat({ provider: 'google', model: 'gemini-1.5-flash' });
    expect(chat.proxyBaseUrl).toContain('/v1/proxy/generativelanguage.googleapis.com');
  });

  it('creates a chat instance for groq', () => {
    const chat = createFagsChat({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
    expect(chat.proxyBaseUrl).toContain('/v1/proxy/api.groq.com');
  });

  it('throws for unknown provider', () => {
    expect(() => createFagsChat({ provider: 'unknown' as any, model: 'x' })).toThrow(
      'Unknown provider',
    );
  });

  it('has invoke and stream methods', () => {
    const chat = createFagsChat({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(typeof chat.invoke).toBe('function');
    expect(typeof chat.stream).toBe('function');
  });
});

describe('getFagsLangChainConfig', () => {
  it('returns config with correct model name', () => {
    const config = getFagsLangChainConfig('gpt-4o-mini');
    expect(config.modelName).toBe('gpt-4o-mini');
  });

  it('returns config with proxy base URL', () => {
    const config = getFagsLangChainConfig('gpt-4o-mini', 'openai');
    expect(config.configuration.baseURL).toContain('/v1/proxy/api.openai.com/v1');
  });

  it('returns config with placeholder API key', () => {
    const config = getFagsLangChainConfig('gpt-4o-mini');
    expect(config.openAIApiKey).toBe('fags-proxy-managed');
  });

  it('defaults to openai provider', () => {
    const config = getFagsLangChainConfig('gpt-4o-mini');
    expect(config.configuration.baseURL).toContain('api.openai.com');
  });

  it('supports groq provider', () => {
    const config = getFagsLangChainConfig('llama-3.3-70b', 'groq');
    expect(config.configuration.baseURL).toContain('api.groq.com');
  });

  it('has default temperature', () => {
    const config = getFagsLangChainConfig('gpt-4o-mini');
    expect(config.temperature).toBe(0.7);
  });
});
