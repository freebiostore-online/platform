import { useEffect, useRef, useState } from 'react';
import { ModelLoader } from '../model.js';
import type { ModelConfig, ModelStatus } from '../types.js';

/**
 * React hook for loading an AI model with progress tracking.
 *
 * Usage:
 * ```tsx
 * const { status, load } = useModel({
 *   repo: 'onnx-community/whisper-small',
 *   device: 'auto',
 * });
 *
 * if (status.state === 'downloading') return <Progress value={status.progress} />;
 * if (status.state === 'ready') return <Transcriber />;
 * ```
 */
export function useModel(config: ModelConfig) {
  const [status, setStatus] = useState<ModelStatus>({ state: 'idle' });
  const loaderRef = useRef<ModelLoader | null>(null);

  useEffect(() => {
    const loader = new ModelLoader();
    loaderRef.current = loader;
    const unsub = loader.onStatusChange(setStatus);
    return unsub;
  }, []);

  const load = async () => {
    await loaderRef.current?.load(config);
  };

  const hasWebGPU = useRef<boolean | null>(null);
  useEffect(() => {
    ModelLoader.hasWebGPU().then((v) => {
      hasWebGPU.current = v;
    });
  }, []);

  return {
    status,
    load,
    isReady: status.state === 'ready',
    isLoading: status.state === 'downloading' || status.state === 'loading',
    hasWebGPU: hasWebGPU.current,
    /** Update status from Web Worker messages. */
    updateFromWorker: (msg: any) => loaderRef.current?.updateFromWorker(msg),
  };
}
