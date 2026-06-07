import { useState, useEffect, useCallback } from 'react';
import TrainAgent from './TrainAgent';

// Auth via FAS API (shared session signing key across all stores)
const AUTH_API = 'https://api.freeappstore.online';
const GITHUB_ORG = 'FreeBioStore';
const SESSION_KEY = 'fags:session';

interface User {
  id: string;
  login: string;
  avatarUrl: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  task: string;
  category: string;
  model: string;
  modelSize: string;
  type: string;
  agentUrl: string;
}

interface DeployRun {
  name: string;
  status: string;
  updatedAt: string;
  sha: string;
  url: string;
}

function getStoredToken(): string | null {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}

function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [trainingAgent, setTrainingAgent] = useState<Agent | null>(null);
  const [deployHistory, setDeployHistory] = useState<DeployRun[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  const isDark = theme === 'dark';

  // On mount: check for fas_session in URL (OAuth callback) or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionFromUrl = params.get('fas_session');
    if (sessionFromUrl) {
      storeToken(sessionFromUrl);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    const token = sessionFromUrl ?? getStoredToken();
    if (token) {
      // Verify token by calling /auth/me
      fetch(`${AUTH_API}/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.user) {
            setUser(data.user);
            storeToken(token);
          } else {
            storeToken(null);
          }
        })
        .catch(() => storeToken(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Load agents from registry
  useEffect(() => {
    fetch('/registry.json')
      .then(r => r.json())
      .then(data => setAgents(data.agents ?? []))
      .catch(() => {});
  }, []);

  // Load deploy history when agent selected
  useEffect(() => {
    if (!selectedAgent) { setDeployHistory([]); return; }
    fetch(`https://api.github.com/repos/${GITHUB_ORG}/platform/actions/runs?per_page=5`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'fags-console' },
    })
      .then(r => r.json())
      .then(data => {
        setDeployHistory((data.workflow_runs ?? []).map((r: any) => ({
          name: r.name,
          status: r.conclusion ?? r.status,
          updatedAt: r.updated_at,
          sha: r.head_sha?.slice(0, 7),
          url: r.html_url,
        })));
      })
      .catch(() => setDeployHistory([]));
  }, [selectedAgent]);

  const signIn = () => {
    // Redirect to FAS auth with return_to pointing back here
    // FAS auth will redirect back with ?fas_session=TOKEN
    const returnTo = window.location.origin + window.location.pathname;
    window.location.href = `${AUTH_API}/v1/auth/github/start?app_id=fags-console&response_mode=query&return_to=${encodeURIComponent(returnTo)}`;
  };

  const signOut = () => {
    storeToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-neutral-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Not signed in — landing page
  if (!user) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${isDark ? 'bg-neutral-950' : 'bg-gradient-to-br from-gray-50 via-white to-violet-50'}`}>
        <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
            style={{ fontFamily: 'var(--font-serif)' }}>
          Creator Console
        </h1>
        <p className={`mb-6 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
          Sign in with GitHub to manage your AI agents on FreeBioStore.
        </p>
        <button
          onClick={signIn}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-base transition-colors"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
          </svg>
          Sign in with GitHub
        </button>
        <p className={`mt-4 text-sm ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
          Part of <a href="https://freebiostore.online" className="underline">FreeBioStore</a>
        </p>
      </div>
    );
  }

  // Signed in — dashboard
  return (
    <div className={`min-h-screen ${isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`border-b ${isDark ? 'border-neutral-800 bg-neutral-950' : 'border-gray-200 bg-white'} sticky top-0 z-10`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <a href="/" className="flex items-center gap-2 text-sm no-underline"
             style={{ color: isDark ? '#a3a3a3' : '#6b7280' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: isDark ? '#fff' : '#111' }}>
              Agent<span style={{ color: '#a78bfa' }}>Console</span>
            </span>
          </a>
          <nav className="flex gap-4 ml-auto text-sm font-medium">
            <a href="https://freebiostore.online" className={isDark ? 'text-neutral-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>Store</a>
            <a href="https://freebiostore.online/skills.md" className={isDark ? 'text-neutral-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>Docs</a>
            <a href={`https://github.com/${GITHUB_ORG}`} className={isDark ? 'text-neutral-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>GitHub</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm ${isDark ? 'border-neutral-700 text-neutral-400' : 'border-gray-200 text-gray-500'}`}>
              {isDark ? '☀' : '🌙'}
            </button>
            <img src={user.avatarUrl} alt={user.login} className="w-8 h-8 rounded-full" />
            <span className="text-sm font-medium">{user.login}</span>
            <button onClick={signOut} className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'} hover:underline`}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {trainingAgent ? (
          <TrainAgent
            agentId={trainingAgent.id}
            agentName={trainingAgent.name}
            isDark={isDark}
            onBack={() => setTrainingAgent(null)}
          />
        ) : selectedAgent ? (
          <AgentDetail
            agent={selectedAgent}
            deploys={deployHistory}
            onBack={() => setSelectedAgent(null)}
            onTrain={() => { setTrainingAgent(selectedAgent); setSelectedAgent(null); }}
            isDark={isDark}
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Agents</h2>
              <span className={`text-sm ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>{agents.length} agents</span>
            </div>

            <div className="grid gap-3">
              {agents.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAgent(a)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    isDark
                      ? 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
                      : 'bg-white border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{a.name}</div>
                      <div className={`text-sm truncate ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{a.description}</div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-gray-100 text-gray-500'}`}>
                        {a.category}
                      </span>
                      {a.type === 'heuristic' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-900/30 text-amber-400">heuristic</span>
                      )}
                      {a.type === 'built-in-ai' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-400">built-in AI</span>
                      )}
                    </div>
                    <svg className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-neutral-600' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            {agents.length === 0 && (
              <div className={`text-center py-12 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                <p className="mb-2">No agents yet.</p>
                <p className="text-sm">Create one with <code className={`px-1 py-0.5 rounded text-xs ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`}>fags init my-agent</code> or via the MCP server.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AgentDetail({ agent, deploys, onBack, onTrain, isDark }: {
  agent: Agent;
  deploys: DeployRun[];
  onBack: () => void;
  onTrain: () => void;
  isDark: boolean;
}) {
  const [liveStatus, setLiveStatus] = useState<string>('checking...');

  useEffect(() => {
    fetch(agent.agentUrl, { method: 'HEAD' })
      .then(r => setLiveStatus(r.ok ? `Live (${r.status})` : `Down (${r.status})`))
      .catch(() => setLiveStatus('Unreachable'));
  }, [agent.agentUrl]);

  return (
    <div>
      <button onClick={onBack} className={`text-sm mb-4 flex items-center gap-1 ${isDark ? 'text-neutral-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to agents
      </button>

      <div className={`rounded-xl border p-6 mb-4 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'}`}>
        <h2 className="text-xl font-bold mb-1">{agent.name}</h2>
        <p className={`text-sm mb-4 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{agent.description}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>Status</div>
            <div className={liveStatus.startsWith('Live') ? 'text-green-400' : 'text-red-400'}>{liveStatus}</div>
          </div>
          <div>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>Category</div>
            <div>{agent.category}</div>
          </div>
          <div>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>Model</div>
            <div>{agent.model ?? 'None'}</div>
          </div>
          <div>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>Size</div>
            <div>{agent.modelSize ?? '0MB'}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <a href={agent.agentUrl} target="_blank" rel="noopener"
             className="text-xs px-3 py-1.5 rounded-lg text-white font-medium no-underline" style={{ backgroundColor: 'var(--accent)' }}>
            Open Demo
          </a>
          <a href={`https://github.com/${GITHUB_ORG}/platform/tree/main/agents/${agent.id}`} target="_blank" rel="noopener"
             className={`text-xs px-3 py-1.5 rounded-lg border font-medium no-underline ${isDark ? 'border-neutral-700 text-neutral-300' : 'border-gray-300 text-gray-700'}`}>
            View Source
          </a>
          <a href={`https://freebiostore.online/agents/${agent.id}/`}
             className={`text-xs px-3 py-1.5 rounded-lg border font-medium no-underline ${isDark ? 'border-neutral-700 text-neutral-300' : 'border-gray-300 text-gray-700'}`}>
            Detail Page
          </a>
          <button onClick={onTrain}
             className="text-xs px-3 py-1.5 rounded-lg border font-medium bg-amber-600 border-amber-600 text-white">
            Train Custom Instance
          </button>
        </div>
      </div>

      {/* Deploy history */}
      <div className={`rounded-xl border p-4 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'}`}>
        <h3 className="text-sm font-semibold mb-3">Recent Deploys</h3>
        {deploys.length === 0 ? (
          <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>No deploy history.</p>
        ) : (
          <div className="space-y-2">
            {deploys.map((d, i) => (
              <a key={i} href={d.url} target="_blank" rel="noopener"
                 className={`flex items-center gap-3 text-sm p-2 rounded-lg no-underline ${isDark ? 'hover:bg-neutral-800' : 'hover:bg-gray-50'}`}>
                <span className={d.status === 'success' ? 'text-green-400' : d.status === 'failure' ? 'text-red-400' : 'text-yellow-400'}>
                  {d.status === 'success' ? '✓' : d.status === 'failure' ? '✗' : '...'}
                </span>
                <span className={isDark ? 'text-neutral-300' : 'text-gray-700'}>{d.name}</span>
                <code className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>{d.sha}</code>
                <span className={`ml-auto text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                  {new Date(d.updatedAt).toLocaleDateString()}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
