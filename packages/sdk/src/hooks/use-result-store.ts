import { useCallback, useEffect, useRef, useState } from 'react';
import { ResultStore } from '../result-store.js';

/**
 * React hook for persisting agent results in IndexedDB.
 *
 * Usage:
 * ```tsx
 * const { save, load, history } = useResultStore('transcriptions');
 * await save('abc123', { text: 'Hello world', timestamp: Date.now() });
 * ```
 */
export function useResultStore(namespace: string) {
  const [history, setHistory] = useState<{ id: string; savedAt: number }[]>([]);
  const storeRef = useRef(new ResultStore(namespace));

  const refresh = useCallback(async () => {
    const items = await storeRef.current.list();
    setHistory(items.sort((a, b) => b.savedAt - a.savedAt));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (id: string, data: unknown) => {
      await storeRef.current.save(id, data);
      await refresh();
    },
    [refresh],
  );

  const load = useCallback(<T = unknown>(id: string) => storeRef.current.load<T>(id), []);

  const remove = useCallback(
    async (id: string) => {
      await storeRef.current.delete(id);
      await refresh();
    },
    [refresh],
  );

  const clear = useCallback(async () => {
    await storeRef.current.clear();
    setHistory([]);
  }, []);

  return { save, load, remove, clear, history };
}
