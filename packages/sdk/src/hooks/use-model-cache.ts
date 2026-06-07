import { useCallback, useEffect, useRef, useState } from 'react';
import { ModelCache } from '../model-cache.js';

/**
 * React hook for managing the shared model cache.
 *
 * Usage:
 * ```tsx
 * const { cachedModels, totalSize, clearCache } = useModelCache();
 * ```
 */
export function useModelCache() {
  const [cachedModels, setCachedModels] = useState<string[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const cacheRef = useRef(new ModelCache());

  const refresh = useCallback(async () => {
    const [keys, size] = await Promise.all([cacheRef.current.keys(), cacheRef.current.size()]);
    setCachedModels(keys);
    setTotalSize(size);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clearCache = useCallback(async () => {
    await cacheRef.current.clear();
    setCachedModels([]);
    setTotalSize(0);
  }, []);

  const removeModel = useCallback(
    async (url: string) => {
      await cacheRef.current.remove(url);
      await refresh();
    },
    [refresh],
  );

  return {
    cachedModels,
    totalSize,
    clearCache,
    removeModel,
    refresh,
    /** Format bytes as human-readable string. */
    formatSize: (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    },
  };
}
