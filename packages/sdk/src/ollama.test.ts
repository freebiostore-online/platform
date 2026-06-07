import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OllamaClient } from './ollama.js';

describe('OllamaClient', () => {
  let client: OllamaClient;

  beforeEach(() => {
    client = new OllamaClient('http://localhost:11434');
    vi.restoreAllMocks();
  });

  it('detect() returns available:true when Ollama responds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            models: [
              {
                name: 'llama3.2',
                size: 2_000_000_000,
                details: { parameter_size: '3B', quantization_level: 'Q4_0' },
              },
            ],
          }),
      }),
    );

    const status = await client.detect();
    expect(status.available).toBe(true);
    expect(status.models).toHaveLength(1);
    expect(status.models[0].name).toBe('llama3.2');
    expect(status.models[0].parameterSize).toBe('3B');
  });

  it('detect() returns available:false when Ollama is not running', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const status = await client.detect();
    expect(status.available).toBe(false);
    expect(status.models).toEqual([]);
  });

  it('detect() returns available:false when API returns error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const status = await client.detect();
    expect(status.available).toBe(false);
  });

  it('generate() calls Ollama API and returns response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'Hello world!' }),
      }),
    );

    const result = await client.generate('llama3.2', 'Say hello');
    expect(result).toBe('Hello world!');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('generate() throws on API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(client.generate('llama3.2', 'hello')).rejects.toThrow(
      'Ollama generate failed: 500',
    );
  });

  it('status getter reflects last detect call', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      }),
    );

    expect(client.status.available).toBe(false); // before detect
    await client.detect();
    expect(client.status.available).toBe(true); // after detect
  });
});
