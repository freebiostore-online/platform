import { useState } from 'react';
import { runPipeline, type PipelineResult } from './heuristic';

export default function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<PipelineResult | null>(null);

  const handleChange = (text: string) => {
    setInput(text);
    setResult(text.trim() ? runPipeline(text) : null);
  };

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freebiostore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeBioStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>AGENTNAME</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">Pipeline — trainable</span>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full p-4 gap-4">
        <div className="flex-1">
          <textarea
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Paste HTML to run the pipeline..."
            className="w-full h-64 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-y focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600 font-mono text-sm"
            spellCheck={false}
          />
        </div>

        <div className="flex-1 space-y-3">
          {result && (
            <>
              {/* Steps */}
              <div className="space-y-1">
                {result.steps.map((s, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    s.status === 'pass' ? 'bg-emerald-950/30 border border-emerald-900'
                    : s.status === 'fail' ? 'bg-red-950/30 border border-red-900'
                    : 'bg-neutral-900 border border-neutral-800'
                  }`}>
                    <span className={`font-mono text-xs ${
                      s.status === 'pass' ? 'text-emerald-400' : s.status === 'fail' ? 'text-red-400' : 'text-neutral-600'
                    }`}>{s.status.toUpperCase()}</span>
                    <span className="text-neutral-300">{s.name}</span>
                    <span className="text-xs text-neutral-600 ml-auto">{s.timeMs.toFixed(1)}ms</span>
                  </div>
                ))}
              </div>

              {/* Action */}
              {result.action && (
                <div className="p-4 rounded-lg bg-violet-950/30 border border-violet-800">
                  <div className="text-xs text-neutral-500 mb-1">Action</div>
                  <div className="font-semibold text-violet-400">{result.action.type}</div>
                  {result.action.target && <div className="font-mono text-xs text-neutral-400 mt-1">{result.action.target}</div>}
                  {result.action.value && <div className="text-sm text-neutral-300 mt-1">{result.action.value}</div>}
                  <div className="text-xs text-neutral-500 mt-1">{(result.action.confidence * 100).toFixed(0)}% confidence</div>
                </div>
              )}

              {!result.action && (
                <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 text-center text-neutral-600 text-sm">
                  Pipeline produced no action (a step failed or input was unrecognized)
                </div>
              )}
            </>
          )}

          {!result && (
            <div className="text-center text-neutral-600 text-sm py-8">Paste HTML to run the pipeline</div>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        LLM-distilled pipeline. Each step is a trained heuristic — zero tokens at runtime.
      </footer>
    </div>
  );
}
