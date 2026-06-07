const CACHE_NAME = 'fags-models';

/**
 * Shared model cache using the Cache Storage API.
 * Models are stored by their HuggingFace URL and persist across sessions.
 */
export class ModelCache {
  /** Check if a specific model URL is cached. */
  async has(url: string): Promise<boolean> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(url);
      return match !== undefined;
    } catch {
      return false;
    }
  }

  /** Get a cached response, or null if not cached. */
  async get(url: string): Promise<Response | null> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(url);
      return match ?? null;
    } catch {
      return null;
    }
  }

  /** Cache a response. The response is cloned before caching. */
  async put(url: string, response: Response): Promise<void> {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, response.clone());
  }

  /** List all cached model URLs. */
  async keys(): Promise<string[]> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const requests = await cache.keys();
      return requests.map((r) => r.url);
    } catch {
      return [];
    }
  }

  /** Get estimated total cache size in bytes. */
  async size(): Promise<number> {
    try {
      const estimate = await navigator.storage.estimate();
      return estimate.usage ?? 0;
    } catch {
      return 0;
    }
  }

  /** Clear all cached models. */
  async clear(): Promise<void> {
    await caches.delete(CACHE_NAME);
  }

  /** Remove a specific cached model. */
  async remove(url: string): Promise<boolean> {
    const cache = await caches.open(CACHE_NAME);
    return cache.delete(url);
  }
}
