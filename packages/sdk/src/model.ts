import type { ModelConfig, ModelStatus } from './types.js';

/**
 * Loads AI models from HuggingFace, manages WebGPU/WASM fallback,
 * and caches in Cache Storage for instant subsequent loads.
 */
export class ModelLoader {
  private listeners = new Set<(status: ModelStatus) => void>();
  private status: ModelStatus = { state: 'idle' };

  /** Check if WebGPU is available in this browser. */
  static async hasWebGPU(): Promise<boolean> {
    if (!('gpu' in navigator)) return false;
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  /** Resolve the best available device. */
  static async resolveDevice(preferred?: ModelConfig['device']): Promise<'webgpu' | 'wasm'> {
    if (preferred === 'wasm') return 'wasm';
    if (preferred === 'webgpu' || preferred === 'auto' || !preferred) {
      return (await ModelLoader.hasWebGPU()) ? 'webgpu' : 'wasm';
    }
    return 'wasm';
  }

  /** Check if a model is already cached. */
  async isCached(repo: string): Promise<boolean> {
    try {
      const cache = await caches.open('fags-models');
      const keys = await cache.keys();
      return keys.some((r) => r.url.includes(repo.replace('/', '--')));
    } catch {
      return false;
    }
  }

  /** Get total cached model size in bytes. */
  async getCacheSize(): Promise<number> {
    try {
      const estimate = await navigator.storage.estimate();
      return estimate.usage ?? 0;
    } catch {
      return 0;
    }
  }

  /** Clear all cached models. */
  async clearCache(): Promise<void> {
    await caches.delete('fags-models');
  }

  /**
   * Load a model. This is a high-level method that:
   * 1. Checks Cache Storage for existing model
   * 2. Downloads from HuggingFace if not cached
   * 3. Reports progress via onStatusChange
   * 4. Returns when model is ready for inference
   *
   * The actual inference runs in a Web Worker (see WorkerBridge).
   * This method just ensures the model files are available.
   */
  async load(config: ModelConfig): Promise<void> {
    await ModelLoader.resolveDevice(config.device);
    const cached = await this.isCached(config.repo);

    if (cached) {
      this.emit({ state: 'ready' });
      return;
    }

    this.emit({ state: 'downloading', progress: 0, totalBytes: 0 });

    // Model download is handled by the inference library (Transformers.js / ONNX RT)
    // inside the Web Worker. This method signals readiness tracking only.
    // The actual pipeline().then() happens in the worker.
    // We set status to 'loading' — the worker will postMessage 'ready' when done.
    this.emit({ state: 'loading' });
  }

  /** Update status from Web Worker messages. */
  updateFromWorker(msg: { type: string; progress?: number; totalBytes?: number; error?: string }) {
    switch (msg.type) {
      case 'download-progress':
        this.emit({
          state: 'downloading',
          progress: msg.progress ?? 0,
          totalBytes: msg.totalBytes ?? 0,
        });
        break;
      case 'model-ready':
        this.emit({ state: 'ready' });
        break;
      case 'error':
        this.emit({ state: 'error', error: msg.error ?? 'Unknown error' });
        break;
    }
  }

  onStatusChange(fn: (status: ModelStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status); // emit current
    return () => this.listeners.delete(fn);
  }

  getStatus(): ModelStatus {
    return this.status;
  }

  private emit(status: ModelStatus) {
    this.status = status;
    for (const fn of this.listeners) fn(status);
  }
}
