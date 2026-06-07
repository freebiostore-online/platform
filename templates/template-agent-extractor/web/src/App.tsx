import { useState } from 'react';
import { extract, type ExtractionResult } from './heuristic';

export default function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ExtractionResult | null>(null);

  const handleChange = (text: string) => {
    setInput(text);
    setResult(text.trim() ? extract(text) : null);
  };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freebiostore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeBioStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>AGENTNAME</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">Heuristic — trainable</span>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full p-4 gap-4">
        <div className="flex-1">
          <textarea
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Paste HTML or text to extract from..."
            className="w-full h-64 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-y focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm"
            spellCheck={false}
          />
        </div>

        <div className="flex-1">
          {result && result.fields.length > 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg divide-y divide-neutral-800">
              {result.fields.map((f, i) => (
                <div key={i} className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-violet-400">{f.role}</span>
                    <span className="text-xs font-mono text-neutral-500">{(f.confidence * 100).toFixed(0)}%</span>
                  </div>
                  {f.value && <div className="text-sm text-neutral-300 mb-1">{f.value}</div>}
                  <div className="text-xs font-mono text-neutral-600 truncate">{f.selector}</div>
                </div>
              ))}
            </div>
          ) : result ? (
            <div className="text-center text-neutral-600 text-sm py-8">No fields found</div>
          ) : (
            <div className="text-center text-neutral-600 text-sm py-8">Paste input to extract data</div>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        LLM-distilled heuristic. Trainable via the <a href="/a/trainer/" className="underline">Trainer</a>.
      </footer>
    </div>
  );
}
