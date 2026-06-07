import { useState, useRef, useCallback } from 'react';

type KokoroState = 'idle' | 'loading' | 'ready' | 'generating' | 'error';

let worker: Worker | null = null;
let workerReady = false;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker('/kokoro-worker.js', { type: 'module' });
  return worker;
}

export function useKokoro() {
  const [state, setState] = useState<KokoroState>('idle');
  const [progress, setProgress] = useState(0);
  const [backend, setBackend] = useState<'webgpu' | 'wasm' | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const init = useCallback(async () => {
    if (workerReady) {
      setState('ready');
      return;
    }
    setState('loading');
    setProgress(0);

    const w = getWorker();

    await new Promise<void>((resolve, reject) => {
      function onMsg(e: MessageEvent) {
        if (e.data.type === 'progress') {
          setProgress(e.data.pct);
        } else if (e.data.type === 'ready') {
          workerReady = true;
          setBackend(e.data.device);
          setState('ready');
          w.removeEventListener('message', onMsg);
          resolve();
        } else if (e.data.type === 'error' && !workerReady) {
          setState('error');
          w.removeEventListener('message', onMsg);
          reject(new Error(e.data.error));
        }
      }
      w.addEventListener('message', onMsg);
      w.postMessage({ type: 'init' });
    });
  }, []);

  const generateInWorker = useCallback(
    (text: string, voice: string): Promise<{ audio: Float32Array; sampleRate: number }> => {
      return new Promise((resolve, reject) => {
        const w = getWorker();
        const id = Math.random().toString(36).slice(2);
        function onMsg(e: MessageEvent) {
          if (e.data.id !== id) return;
          w.removeEventListener('message', onMsg);
          if (e.data.type === 'audio') {
            resolve({ audio: e.data.audio, sampleRate: e.data.sampleRate });
          } else if (e.data.type === 'error') {
            reject(new Error(e.data.error));
          }
        }
        w.addEventListener('message', onMsg);
        w.postMessage({ type: 'generate', id, text, voice });
      });
    },
    [],
  );

  const generate = useCallback(
    async (text: string, voice: string, rate: number) => {
      if (!workerReady || !text.trim()) return;
      setState('generating');

      // Split into sentences
      const sentences = splitSentences(text);
      if (sentences.length === 0) {
        setState('ready');
        return;
      }

      let stopped = false;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      const sources: AudioBufferSourceNode[] = [];
      let nextStart = ctx.currentTime;
      let finished = 0;

      stopRef.current = () => {
        stopped = true;
        for (const s of sources) {
          try { s.stop(); } catch {}
        }
        ctx.close().catch(() => {});
        setState('ready');
      };

      for (let i = 0; i < sentences.length && !stopped; i++) {
        try {
          const { audio, sampleRate } = await generateInWorker(sentences[i], voice);
          if (stopped) break;

          const buf = ctx.createBuffer(1, audio.length, sampleRate);
          buf.copyToChannel(audio, 0);

          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.playbackRate.value = rate;
          src.connect(ctx.destination);
          src.start(nextStart);
          sources.push(src);
          nextStart += buf.duration / rate;

          src.onended = () => {
            finished++;
            if (finished >= sentences.length && !stopped) {
              setState('ready');
            }
          };
        } catch {
          finished++;
          if (finished >= sentences.length && !stopped) setState('ready');
        }
      }

      if (stopped) setState('ready');
    },
    [generateInWorker],
  );

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  return { state, progress, backend, init, generate, stop };
}

function splitSentences(text: string): string[] {
  const raw = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const merged: string[] = [];
  let buf = '';
  for (const s of raw) {
    buf += s;
    if (buf.length >= 200) {
      merged.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim()) merged.push(buf.trim());
  return merged.filter((s) => s.length > 0);
}
