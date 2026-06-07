import { useEffect, useState } from 'react';
import type { Automation } from '../types';

export default function App() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'BG_GET_STATE' }).then((res) => {
      setAutomations(res.automations ?? []);
      setRecording(res.recording ?? false);
    });
  }, []);

  const openSidePanel = () => {
    chrome.runtime.sendMessage({ type: 'BG_OPEN_SIDEPANEL' });
    window.close();
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">FAGS Automator</span>
        <button
          type="button"
          onClick={openSidePanel}
          className="text-[10px] text-neutral-500 hover:text-neutral-300 underline"
        >
          Open Panel
        </button>
      </div>

      {recording && (
        <div className="flex items-center gap-2 p-2 rounded bg-red-950/50 border border-red-900 text-xs text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Recording in progress...
        </div>
      )}

      {/* Quick replay for matching automations */}
      {automations.length > 0 ? (
        <div className="space-y-1">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Quick Replay</div>
          {automations.slice(0, 5).map((a) => (
            <button
              type="button"
              key={a.id}
              onClick={async () => {
                await chrome.runtime.sendMessage({ type: 'BG_REPLAY', automation: a });
                window.close();
              }}
              className="w-full text-left px-2 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 transition-colors"
            >
              <div className="text-xs font-medium truncate">{a.name}</div>
              <div className="text-[10px] text-neutral-600">
                {a.site} — {a.actions.length} steps
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-neutral-600 text-center py-2">
          No automations yet. Open the panel to record.
        </div>
      )}

      <div className="text-[10px] text-neutral-700 text-center">
        Open side panel for recording, training, and management.
      </div>
    </div>
  );
}
