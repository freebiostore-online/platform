import { useState } from 'react';

export default function App() {
  const [input, setInput] = useState('');

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freebiostore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeBioStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          AGENTNAME
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Heuristic
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or paste input..."
          className="w-full h-40 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
        />

        {/* TODO: Add your agent's output UI here */}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Heuristic agent — runs entirely in your browser.
        <a href="https://github.com/FreeBioStore/AGENTNAME" className="underline ml-1">View source</a>
      </footer>
    </div>
  );
}
