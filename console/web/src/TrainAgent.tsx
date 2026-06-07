import { useState, useCallback } from 'react';

interface TrainingExample {
  input: string;
  expectedOutput: string;
}

interface EvolutionEntry {
  version: number;
  score: number;
  examplesUsed: number;
  change: string;
}

interface AgentConfig {
  baseAgent: string;
  baseVersion: string;
  instanceName: string;
  systemPrompt?: string;
  evolvedCode?: string;
  examples: TrainingExample[];
  evolutionHistory: EvolutionEntry[];
  trainedOn: number;
  accuracy: number;
}

export default function TrainAgent({ agentId, agentName, isDark, onBack }: {
  agentId: string;
  agentName: string;
  isDark: boolean;
  onBack: () => void;
}) {
  const [instanceName, setInstanceName] = useState(`my-${agentId}`);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [newInput, setNewInput] = useState('');
  const [newOutput, setNewOutput] = useState('');
  const [evolving, setEvolving] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState('');
  const [aiStatus, setAiStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

  // Check built-in AI on mount
  useState(() => {
    (async () => {
      const g = globalThis as any;
      const LM = g.LanguageModel ?? g.ai?.languageModel;
      if (LM?.availability) {
        const s = await LM.availability();
        setAiStatus(s === 'available' || s === 'readily' ? 'available' : 'unavailable');
      } else {
        setAiStatus('unavailable');
      }
    })();
  });

  const createInstance = useCallback(() => {
    setConfig({
      baseAgent: agentId,
      baseVersion: '1.0.0',
      instanceName,
      examples: [],
      evolutionHistory: [],
      trainedOn: 0,
      accuracy: 0,
    });
  }, [agentId, instanceName]);

  const addExample = useCallback(() => {
    if (!newInput.trim() || !newOutput.trim()) return;
    const ex = { input: newInput.trim(), expectedOutput: newOutput.trim() };
    setExamples(prev => [...prev, ex]);
    setNewInput('');
    setNewOutput('');
  }, [newInput, newOutput]);

  const evolve = useCallback(async () => {
    if (!config || examples.length === 0) return;
    setEvolving(true);

    const allExamples = [...config.examples, ...examples];

    // Build prompt
    const prompt = [
      `Write a JavaScript function body that takes \`input\` (string) and returns the result.`,
      `Agent: ${agentId} — ${instanceName}`,
      ``,
      `Examples (${allExamples.length}):`,
      ...allExamples.slice(0, 30).map(e => `- Input: ${JSON.stringify(e.input)} → Output: ${JSON.stringify(e.expectedOutput)}`),
      ``,
      config.evolvedCode ? `Current code (improve it):\n\`\`\`\n${config.evolvedCode}\n\`\`\`` : '',
      ``,
      `The code must be DETERMINISTIC. Use only if/else, loops, regex, Math, String, Array.`,
      `Return ONLY the function body code.`,
    ].join('\n');

    let code = '';
    let source = 'none';

    try {
      // Try built-in AI
      const g = globalThis as any;
      const LM = g.LanguageModel ?? g.ai?.languageModel;
      if (LM?.create) {
        const session = await LM.create({ systemPrompt: 'You write JavaScript. Return only code, no explanation.' });
        const raw = await session.prompt(prompt);
        session.destroy?.();
        code = extractCode(raw);
        source = 'built-in';
      }
    } catch {}

    if (!code) {
      try {
        // Try Ollama
        const res = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        });
        if (res.ok) {
          code = extractCode((await res.json()).response);
          source = 'ollama';
        }
      } catch {}
    }

    if (!code) {
      setEvolving(false);
      alert('No AI available. Enable Chrome Built-in AI or run Ollama locally.');
      return;
    }

    // Evaluate
    let passed = 0;
    for (const ex of allExamples) {
      try {
        const fn = new Function('input', code);
        const result = fn(ex.input);
        if (JSON.stringify(result) === JSON.stringify(JSON.parse(ex.expectedOutput))) passed++;
      } catch {}
    }

    const score = allExamples.length > 0 ? passed / allExamples.length : 0;
    const version = config.evolutionHistory.length + 1;

    setConfig({
      ...config,
      evolvedCode: code,
      examples: allExamples,
      evolutionHistory: [
        ...config.evolutionHistory,
        { version, score, examplesUsed: allExamples.length, change: `v${version} via ${source}: ${(score * 100).toFixed(0)}% (${passed}/${allExamples.length})` },
      ],
      trainedOn: allExamples.length,
      accuracy: Math.round(score * 100),
    });
    setExamples([]);
    setEvolving(false);
  }, [config, examples, agentId, instanceName]);

  const testCode = useCallback(() => {
    if (!config?.evolvedCode || !testInput.trim()) return;
    try {
      const fn = new Function('input', config.evolvedCode);
      const result = fn(testInput);
      setTestResult(JSON.stringify(result, null, 2));
    } catch (e: any) {
      setTestResult(`Error: ${e.message}`);
    }
  }, [config, testInput]);

  const exportJSON = useCallback(() => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.instanceName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [config]);

  const p = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200';
  const m = isDark ? 'text-neutral-400' : 'text-gray-500';

  return (
    <div>
      <button onClick={onBack} className={`text-sm mb-4 flex items-center gap-1 ${m}`}>
        ← Back
      </button>

      <h2 className="text-lg font-semibold mb-1">Train: {agentName}</h2>
      <p className={`text-sm mb-4 ${m}`}>
        Create a custom instance trained on your data.
        {aiStatus === 'available' && <span className="text-emerald-400 ml-2">Built-in AI ready</span>}
        {aiStatus === 'unavailable' && <span className="text-amber-400 ml-2">Needs Chrome Built-in AI or Ollama</span>}
      </p>

      {!config ? (
        /* Step 1: Name the instance */
        <div className={`p-6 rounded-xl border ${p}`}>
          <h3 className="font-semibold mb-3">Create Instance</h3>
          <label className={`text-sm ${m} block mb-1`}>Instance name</label>
          <input value={instanceName} onChange={e => setInstanceName(e.target.value)}
            className={`w-full p-2.5 rounded-lg border text-sm mb-3 ${p}`}
            placeholder="e.g. healthcare-resume-parser" />
          <button onClick={createInstance} disabled={!instanceName.trim()}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold text-sm disabled:opacity-40">
            Create
          </button>
        </div>
      ) : (
        /* Step 2: Train */
        <div className="space-y-4">
          {/* Status bar */}
          <div className={`p-4 rounded-xl border ${p} flex items-center gap-4`}>
            <div>
              <div className="text-sm font-semibold">{config.instanceName}</div>
              <div className={`text-xs ${m}`}>Base: {config.baseAgent} v{config.baseVersion}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-2xl font-bold" style={{ color: config.accuracy > 80 ? '#4ade80' : config.accuracy > 50 ? '#fbbf24' : '#f87171' }}>
                {config.accuracy}%
              </div>
              <div className={`text-xs ${m}`}>{config.trainedOn} examples · v{config.evolutionHistory.length}</div>
            </div>
          </div>

          {/* Add examples */}
          <div className={`p-4 rounded-xl border ${p}`}>
            <h3 className="font-semibold text-sm mb-3">Add Training Examples</h3>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className={`text-xs ${m}`}>Input</label>
                <textarea value={newInput} onChange={e => setNewInput(e.target.value)}
                  placeholder="Input text..." rows={3}
                  className={`w-full p-2 rounded-lg border text-xs font-mono ${p}`} />
              </div>
              <div>
                <label className={`text-xs ${m}`}>Expected Output (JSON)</label>
                <textarea value={newOutput} onChange={e => setNewOutput(e.target.value)}
                  placeholder='{"field": "value"}' rows={3}
                  className={`w-full p-2 rounded-lg border text-xs font-mono ${p}`} />
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <button onClick={addExample} disabled={!newInput.trim() || !newOutput.trim()}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40 ${p}`}>
                + Add Example
              </button>
              <span className={`text-xs ${m}`}>{examples.length} pending + {config.examples.length} trained</span>
            </div>

            {examples.length > 0 && (
              <div className="mt-2 space-y-1">
                {examples.map((ex, i) => (
                  <div key={i} className={`text-xs p-2 rounded ${isDark ? 'bg-neutral-800' : 'bg-gray-50'} font-mono flex gap-2`}>
                    <span className="truncate flex-1">{ex.input.slice(0, 50)}...</span>
                    <span className={m}>→</span>
                    <span className="truncate flex-1">{ex.expectedOutput.slice(0, 50)}...</span>
                    <button onClick={() => setExamples(prev => prev.filter((_, j) => j !== i))} className="text-red-400 flex-shrink-0">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evolve button */}
          <button onClick={evolve} disabled={evolving || (examples.length === 0 && config.examples.length === 0)}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold disabled:opacity-40">
            {evolving ? 'Evolving...' : `Evolve (${examples.length + config.examples.length} examples)`}
          </button>

          {/* Evolution history */}
          {config.evolutionHistory.length > 0 && (
            <div className={`p-4 rounded-xl border ${p}`}>
              <h3 className="font-semibold text-sm mb-2">Evolution History</h3>
              <div className="space-y-1">
                {config.evolutionHistory.map((e, i) => (
                  <div key={i} className={`text-xs flex items-center gap-2 p-1.5 rounded ${isDark ? 'bg-neutral-800' : 'bg-gray-50'}`}>
                    <span className="font-mono font-bold w-8">v{e.version}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-neutral-700 overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${e.score * 100}%`,
                        backgroundColor: e.score > 0.8 ? '#4ade80' : e.score > 0.5 ? '#fbbf24' : '#f87171'
                      }} />
                    </div>
                    <span className="font-mono w-10 text-right">{(e.score * 100).toFixed(0)}%</span>
                    <span className={`${m} flex-1 truncate`}>{e.change}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test */}
          {config.evolvedCode && (
            <div className={`p-4 rounded-xl border ${p}`}>
              <h3 className="font-semibold text-sm mb-2">Test</h3>
              <textarea value={testInput} onChange={e => setTestInput(e.target.value)}
                placeholder="Paste input to test..." rows={3}
                className={`w-full p-2 rounded-lg border text-xs font-mono mb-2 ${p}`} />
              <button onClick={testCode} disabled={!testInput.trim()}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40 mb-2 ${p}`}>
                Run Test
              </button>
              {testResult && (
                <pre className={`p-2 rounded-lg text-xs font-mono overflow-auto max-h-48 ${isDark ? 'bg-neutral-800' : 'bg-gray-50'}`}>
                  {testResult}
                </pre>
              )}
            </div>
          )}

          {/* Export */}
          <div className="flex gap-2">
            <button onClick={exportJSON}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border ${p}`}>
              Export JSON
            </button>
            <button onClick={() => navigator.clipboard.writeText(JSON.stringify(config, null, 2))}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border ${p}`}>
              Copy Config
            </button>
          </div>

          {/* Code viewer */}
          {config.evolvedCode && (
            <details className={`p-4 rounded-xl border ${p}`}>
              <summary className="font-semibold text-sm cursor-pointer">View Evolved Code</summary>
              <pre className={`mt-2 p-3 rounded-lg text-xs font-mono overflow-auto max-h-64 ${isDark ? 'bg-neutral-800' : 'bg-gray-50'}`}>
                {config.evolvedCode}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function extractCode(response: string): string {
  const fence = response.match(/```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)\n```/);
  if (fence) return fence[1].trim();
  return response.trim();
}
