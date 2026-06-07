import { useState } from 'react';
import { classify, type ClassifierResult } from './heuristic';

export default function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ClassifierResult | null>(null);

  const handleChange = (text: string) => {
    setInput(text);
    setResult(text.trim() ? classify(text) : null);
  };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freebiostore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeBioStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>AGENTNAME</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">Heuristic — trainable</span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        <textarea
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Paste input to classify..."
          className="w-full h-40 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm"
          spellCheck={false}
        />

        {result && (
          <div className={`p-4 rounded-lg border ${result.match ? 'bg-emerald-950/30 border-emerald-800' : 'bg-neutral-900 border-neutral-800'}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xl font-bold ${result.match ? 'text-emerald-400' : 'text-neutral-400'}`}>
                {result.match ? 'Match' : 'No Match'}
              </span>
              <span className="font-mono text-sm text-neutral-500">{(result.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="space-y-1">
              {result.signals.map(s => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <span className={s.found ? (s.weight > 0 ? 'text-emerald-400' : 'text-red-400') : 'text-neutral-700'}>
                    {s.found ? (s.weight > 0 ? '+' : '-') : ' '}
                  </span>
                  <span className={s.found ? 'text-neutral-200' : 'text-neutral-600'}>{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        LLM-distilled heuristic. Trainable via the <a href="/a/trainer/" className="underline">Trainer</a>.
      </footer>
    </div>
  );
}
