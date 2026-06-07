import { useCallback, useEffect, useRef, useState } from 'react';
import { WorkerBridge } from '../worker-bridge.js';

interface UseWorkerInferenceOptions {
  workerUrl: string;
  onProgress?: (data: any) => void;
}

/**
 * React hook for running inference in a Web Worker.
 *
 * Usage:
 * ```tsx
 * const { run, result, running } = useWorkerInference({
 *   workerUrl: '/inference-worker.js',
 * });
 *
 * const transcript = await run('transcribe', { audio: audioBlob });
 * ```
 */
export function useWorkerInference<T = unknown>(options: UseWorkerInferenceOptions) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bridgeRef = useRef<WorkerBridge | null>(null);

  useEffect(() => {
    const bridge = new WorkerBridge(options.workerUrl);
    bridge.start();
    bridgeRef.current = bridge;

    if (options.onProgress) {
      bridge.on('progress', options.onProgress);
    }

    return () => bridge.stop();
  }, [options.workerUrl, options.onProgress]);

  const run = useCallback(
    async (type: string, data?: Record<string, unknown>): Promise<T | null> => {
      if (!bridgeRef.current) return null;
      setRunning(true);
      setError(null);
      try {
        const res = await bridgeRef.current.send<T>(type, data);
        setResult(res);
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
        return null;
      } finally {
        setRunning(false);
      }
    },
    [],
  );

  return { run, result, running, error, bridge: bridgeRef.current };
}
