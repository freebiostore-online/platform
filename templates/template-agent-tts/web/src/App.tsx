import { useState } from 'react';
import { useKokoro } from './hooks/useKokoro';

const VOICES = [
  { id: 'af_heart', label: 'Heart (Female US)' },
  { id: 'af_bella', label: 'Bella (Female US)' },
  { id: 'am_adam', label: 'Adam (Male US)' },
  { id: 'am_michael', label: 'Michael (Male US)' },
  { id: 'bf_emma', label: 'Emma (Female UK)' },
  { id: 'bm_george', label: 'George (Male UK)' },
];

export default function App() {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('af_heart');
  const [rate, setRate] = useState(1.0);
  const { state, progress, backend, init, generate, stop } = useKokoro();

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Topbar */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freebiostore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeBioStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Text to Speech
        </h1>
        {backend && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
            {backend === 'webgpu' ? 'WebGPU' : 'WASM'}
          </span>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Model status */}
        {state === 'idle' && (
          <div className="text-center py-12">
            <p className="text-neutral-400 mb-4">
              AI voice model runs entirely in your browser. ~160MB download, cached for next time.
            </p>
            <button
              onClick={init}
              className="px-6 py-3 rounded-lg font-semibold text-white"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              Download Model
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="text-center py-12">
            <div className="w-48 h-2 bg-neutral-800 rounded-full mx-auto overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, backgroundColor: 'var(--color-accent)' }}
              />
            </div>
            <p className="text-neutral-400 mt-3 text-sm">
              Downloading model... {progress}%
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">Failed to load model. Try a desktop browser with WebGPU support.</p>
            <button onClick={init} className="text-sm underline text-neutral-400">Retry</button>
          </div>
        )}

        {(state === 'ready' || state === 'generating') && (
          <>
            {/* Text input */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type text to convert to speech..."
              className="w-full h-48 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
            />

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-sm text-neutral-400">
                Speed
                <input
                  type="range" min="0.5" max="2" step="0.1" value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="w-20"
                />
                <span className="w-8">{rate}x</span>
              </label>

              <div className="ml-auto flex gap-2">
                {state === 'generating' ? (
                  <button
                    onClick={stop}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-medium text-sm"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={() => generate(text, voice, rate)}
                    disabled={!text.trim()}
                    className="px-4 py-2 rounded-lg font-medium text-sm text-white disabled:opacity-40"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    Generate Speech
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Powered by <a href="https://huggingface.co/hexgrad/Kokoro-82M" className="underline">Kokoro TTS</a>.
        Runs entirely in your browser — your text never leaves your device.
      </footer>
    </div>
  );
}
