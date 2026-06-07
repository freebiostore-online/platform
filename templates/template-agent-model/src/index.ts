/**
 * AGENTNAME — downloads and runs an ONNX model in the browser.
 *
 * Model is downloaded once from HuggingFace CDN, cached in Cache Storage.
 * Inference runs in a Web Worker via WebGPU (preferred) or WASM fallback.
 */

export type ModelStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'error';
export type Backend = 'webgpu' | 'wasm';

export interface ModelConfig {
  repo: string;         // HuggingFace repo: "onnx-community/model-name"
  files: string[];      // Model files to download
  backend: Backend[];   // Preferred backends in order
}

export interface ModelState {
  status: ModelStatus;
  progress: number;     // 0-1 during download
  error: string | null;
  backend: Backend | null;
}

// Default config — override in your agent
export const MODEL_CONFIG: ModelConfig = {
  repo: 'onnx-community/AGENTNAME',
  files: ['model.onnx'],
  backend: ['webgpu', 'wasm'],
};

/** Check if WebGPU is available */
export function hasWebGPU(): boolean {
  return 'gpu' in navigator;
}

/** Get the best available backend */
export function getBestBackend(preferred: Backend[]): Backend {
  for (const b of preferred) {
    if (b === 'webgpu' && hasWebGPU()) return 'webgpu';
    if (b === 'wasm') return 'wasm';
  }
  return 'wasm';
}

/** Cache key for a model file */
function cacheKey(repo: string, file: string): string {
  return `https://huggingface.co/${repo}/resolve/main/${file}`;
}

/** Check if model is cached */
export async function isModelCached(config: ModelConfig = MODEL_CONFIG): Promise<boolean> {
  try {
    const cache = await caches.open('fags-models');
    for (const file of config.files) {
      const match = await cache.match(cacheKey(config.repo, file));
      if (!match) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Download model with progress callback */
export async function downloadModel(
  config: ModelConfig = MODEL_CONFIG,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const cache = await caches.open('fags-models');
  let totalBytes = 0;
  let loadedBytes = 0;

  for (const file of config.files) {
    const url = cacheKey(config.repo, file);
    const existing = await cache.match(url);
    if (existing) continue;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download ${file}: ${response.status}`);

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    totalBytes += contentLength;

    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loadedBytes += value.length;
      onProgress?.(totalBytes > 0 ? loadedBytes / totalBytes : 0);
    }

    const blob = new Blob(chunks);
    await cache.put(url, new Response(blob, { headers: response.headers }));
  }
}

/** Clear cached model */
export async function clearModelCache(config: ModelConfig = MODEL_CONFIG): Promise<void> {
  const cache = await caches.open('fags-models');
  for (const file of config.files) {
    await cache.delete(cacheKey(config.repo, file));
  }
}

/**
 * Run inference. Override this in your agent.
 * The actual ONNX Runtime loading happens in a Web Worker for performance.
 */
export async function run(input: unknown): Promise<unknown> {
  throw new Error('Override run() in your agent implementation');
}
