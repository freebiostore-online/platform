import { useCallback, useEffect, useState } from 'react';
import type { Automation } from '../types';

type View = 'home' | 'detail';

export default function App() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [recording, setRecording] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  const [recordingName, setRecordingName] = useState('');

  const refresh = useCallback(async () => {
    const res = await chrome.runtime.sendMessage({ type: 'BG_GET_STATE' });
    setAutomations(res.automations ?? []);
    setRecording(res.recording ?? false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = automations.find((a) => a.id === selectedId);

  if (view === 'detail' && selected) {
    return (
      <DetailView
        automation={selected}
        onBack={() => {
          setView('home');
          refresh();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
        <span className="font-semibold text-sm">FAGS Automator</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
          v0.1
        </span>
      </div>

      {/* Recording controls */}
      <div className="p-3 border-b border-neutral-800 space-y-2">
        {!recording ? (
          <>
            <input
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              placeholder="Automation name (e.g. Greenhouse Login)"
              className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-xs focus:outline-none focus:border-violet-600"
            />
            <button
              type="button"
              onClick={async () => {
                await chrome.runtime.sendMessage({
                  type: 'BG_START_RECORDING',
                  name: recordingName || 'Untitled',
                });
                setRecording(true);
              }}
              className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
            >
              Start Recording
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={async () => {
              const res = await chrome.runtime.sendMessage({ type: 'BG_STOP_RECORDING' });
              setRecording(false);
              setRecordingName('');
              if (res.automation) {
                setSelectedId(res.automation.id);
                setView('detail');
              }
              refresh();
            }}
            className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors animate-pulse"
          >
            Stop Recording
          </button>
        )}
      </div>

      {/* Automations list */}
      <div className="flex-1 overflow-auto">
        {automations.length === 0 ? (
          <div className="p-4 text-center text-neutral-600 text-xs">
            <p>No automations yet.</p>
            <p className="mt-2">
              Record actions on any website, then train a heuristic that replays them without LLM
              tokens.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {automations.map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => {
                  setSelectedId(a.id);
                  setView('detail');
                }}
                className="w-full text-left px-3 py-2 hover:bg-neutral-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold truncate flex-1">{a.name}</span>
                  {a.accuracy > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1 rounded ${
                        a.accuracy >= 80
                          ? 'bg-emerald-950 text-emerald-400'
                          : a.accuracy >= 50
                            ? 'bg-amber-950 text-amber-400'
                            : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {a.accuracy}%
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-neutral-600 truncate">
                  {a.site} — {a.actions.length} steps
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Detail View ---

function DetailView({ automation, onBack }: { automation: Automation; onBack: () => void }) {
  const [training, setTraining] = useState(false);
  const [status, setStatus] = useState('');
  const [replaying, setReplaying] = useState(false);

  const handleReplay = async () => {
    setReplaying(true);
    setStatus('Replaying...');
    await chrome.runtime.sendMessage({ type: 'BG_REPLAY', automation });
    setReplaying(false);
    setStatus('Replay sent');
  };

  const handleTrain = async () => {
    setTraining(true);
    setStatus('Training heuristic...');
    const res = await chrome.runtime.sendMessage({ type: 'BG_TRAIN', automationId: automation.id });
    setTraining(false);
    if (res.ok) {
      setStatus(
        res.improved
          ? `Improved to ${Math.round(res.result.score * 100)}%`
          : `No improvement (${Math.round(res.result.score * 100)}%)`,
      );
    } else {
      setStatus(`Error: ${res.error}`);
    }
  };

  const handleDelete = async () => {
    await chrome.runtime.sendMessage({ type: 'BG_DELETE_AUTOMATION', automationId: automation.id });
    onBack();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          Back
        </button>
        <span className="font-semibold text-xs truncate flex-1">{automation.name}</span>
        {automation.accuracy > 0 && (
          <span className="text-[10px] font-mono text-emerald-400">{automation.accuracy}%</span>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-b border-neutral-800 flex gap-2">
        <button
          type="button"
          onClick={handleReplay}
          disabled={replaying}
          className="flex-1 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40"
        >
          {replaying ? 'Replaying...' : 'Replay'}
        </button>
        <button
          type="button"
          onClick={handleTrain}
          disabled={training}
          className="flex-1 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-40"
        >
          {training ? 'Training...' : 'Train'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="px-2 py-1.5 rounded bg-neutral-800 text-neutral-400 hover:text-red-400 text-xs"
        >
          Del
        </button>
      </div>

      {status && (
        <div className="px-3 py-1 text-[10px] text-neutral-500 border-b border-neutral-800">
          {status}
        </div>
      )}

      {/* Info */}
      <div className="px-3 py-2 border-b border-neutral-800 text-[10px] text-neutral-600 space-y-0.5">
        <div>Site: {automation.site}</div>
        <div>Pattern: {automation.urlPattern}</div>
        <div>Steps: {automation.actions.length}</div>
        <div>
          Test cases: {automation.testCases.length} (
          {automation.testCases.filter((t) => t.isFailureCase).length} failure cases)
        </div>
        <div>
          Heuristic:{' '}
          {automation.heuristicCode ? `${automation.history.length} versions` : 'Not trained'}
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-auto">
        <div className="px-3 py-1 text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">
          Steps
        </div>
        {automation.actions.map((a, i) => (
          <div key={i} className="px-3 py-1.5 border-b border-neutral-900 flex items-start gap-2">
            <span className="text-[10px] font-mono text-neutral-700 w-4 shrink-0 text-right">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-neutral-300 truncate">{a.label}</div>
              <div className="text-[10px] text-neutral-600 truncate">
                {a.selectors[0]?.value ?? 'no selector'}
                <span className="ml-1 text-neutral-700">{a.selectors[0]?.tier}</span>
              </div>
            </div>
            <span
              className={`text-[10px] px-1 rounded ${
                a.type === 'click'
                  ? 'bg-blue-950 text-blue-400'
                  : a.type === 'fill'
                    ? 'bg-emerald-950 text-emerald-400'
                    : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {a.type}
            </span>
          </div>
        ))}
      </div>

      {/* History */}
      {automation.history.length > 0 && (
        <div className="border-t border-neutral-800">
          <div className="px-3 py-1 text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">
            Training History
          </div>
          <div className="flex gap-0.5 px-3 pb-2 h-8 items-end">
            {automation.history.map((h) => (
              <div
                key={h.version}
                className={`flex-1 rounded-t-sm ${
                  h.score >= 0.8 ? 'bg-emerald-500' : h.score >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ height: `${h.score * 100}%` }}
                title={`v${h.version}: ${Math.round(h.score * 100)}%`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
