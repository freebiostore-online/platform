#!/usr/bin/env node
/**
 * Generates static detail pages for each agent in registry.json.
 * Output: store/dist/agents/{id}/index.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'registry.json'), 'utf-8'));
const outDir = __dirname;

function generateDetailPage(agent, readmeHtml) {
  const isHeuristic = agent.type === 'heuristic';
  const backends = (agent.backends ?? []).join(', ').toUpperCase() || 'None';
  const repoPath = `FreeBioStore/${agent.id}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${agent.name} — FreeBioStore</title>
  <meta name="description" content="${agent.description} Free, private, runs in your browser.">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${agent.name} — FreeBioStore">
  <meta property="og:description" content="${agent.description}">
  <meta property="og:url" content="https://freebiostore.online/agents/${agent.id}/">
  <link rel="canonical" href="https://freebiostore.online/agents/${agent.id}/">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: agent.name,
    description: agent.description,
    applicationCategory: agent.category,
    operatingSystem: 'Web',
    url: agent.agentUrl,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    isPartOf: { '@id': 'https://freebiostore.online/#website' },
  })}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    :root{--font-body:'Manrope',system-ui,sans-serif;--font-display:'Fraunces',Georgia,serif;--paper:#0a0a0a;--panel:#171717;--ink:#fafafa;--muted:#a3a3a3;--muted-soft:#737373;--accent:#7c3aed;--accent-hover:#6d28d9;--line:#262626;--line-strong:#404040;--shadow:0 1px 3px rgba(0,0,0,0.3);--radius:0.75rem}
    body{font-family:var(--font-body);background:var(--paper);color:var(--ink);-webkit-font-smoothing:antialiased;min-height:100vh}
    .container{max-width:1100px;margin:0 auto;padding:0 1.5rem}
    a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}

    header{border-bottom:1px solid var(--line)}
    header .container{display:flex;align-items:center;gap:1.25rem;padding-top:0.75rem;padding-bottom:0.75rem}
    .brand{display:flex;align-items:center;gap:0.6rem;text-decoration:none;color:var(--ink)}
    .brand-mark{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#a855f7);display:flex;align-items:center;justify-content:center;font-size:1.1rem}
    .brand-name{font-family:var(--font-display);font-size:1.15rem;font-weight:700}
    .brand-tag{font-size:0.72rem;color:var(--muted);font-weight:500}
    nav{display:flex;gap:1.25rem;font-size:0.88rem;font-weight:600;margin-left:auto}
    nav a{color:var(--muted);text-decoration:none}nav a:hover{color:var(--ink)}
    nav a.pro{color:#3b82f6}

    .back{display:inline-flex;align-items:center;gap:0.3rem;font-size:0.88rem;color:var(--muted);margin:1.25rem 0 1rem;text-decoration:none}
    .back:hover{color:var(--ink)}

    .detail-split{display:grid;grid-template-columns:1fr;gap:2rem}
    @media(min-width:768px){.detail-split{grid-template-columns:1fr 360px}}

    .hero-icon{width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:2rem;flex-shrink:0}
    .hero{display:flex;gap:1rem;align-items:start;margin-bottom:1.5rem}
    .hero h1{font-family:var(--font-display);font-size:1.75rem;font-weight:700;line-height:1.2}
    .hero .cat{display:inline-block;font-size:0.78rem;padding:0.15rem 0.6rem;border-radius:999px;background:rgba(124,58,237,0.15);color:#a78bfa;margin-top:0.25rem;font-weight:500}
    .hero .heuristic-cat{background:rgba(217,119,6,0.15);color:#fbbf24}
    .hero .dev{font-size:0.82rem;color:var(--muted);margin-top:0.3rem}

    .desc{color:var(--muted);line-height:1.7;margin-bottom:1.25rem;font-size:0.95rem}

    .badges{display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1.25rem}
    .badge-pass{display:inline-flex;align-items:center;gap:0.35rem;font-size:0.82rem;color:#4ade80}
    .badge-pass .dot{width:8px;height:8px;border-radius:50%;background:#4ade80;flex-shrink:0}

    .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;margin-bottom:1.5rem}
    @media(max-width:500px){.meta-grid{grid-template-columns:repeat(2,1fr)}}
    .meta-item .label{font-size:0.72rem;color:var(--muted-soft);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:0.15rem}
    .meta-item .value{font-size:0.88rem}

    .actions{display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:2rem}
    .btn-primary{display:inline-flex;align-items:center;gap:0.4rem;padding:0.6rem 1.25rem;border-radius:10px;background:var(--accent);color:#fff;font-weight:600;font-size:0.9rem;text-decoration:none}
    .btn-primary:hover{background:var(--accent-hover);text-decoration:none}
    .btn-secondary{display:inline-flex;align-items:center;gap:0.4rem;padding:0.6rem 1.25rem;border-radius:10px;border:1px solid var(--line);color:var(--muted);font-weight:600;font-size:0.9rem;text-decoration:none}
    .btn-secondary:hover{border-color:var(--line-strong);color:var(--ink);text-decoration:none}

    .phone-frame{background:var(--panel);border:1px solid var(--line);border-radius:20px;overflow:hidden;aspect-ratio:9/16;max-height:600px}
    .phone-frame iframe{width:100%;height:100%;border:none}
    .preview-note{font-size:0.75rem;color:var(--muted-soft);text-align:center;margin-top:0.5rem}

    .section{margin-bottom:2rem}
    .section h2{font-family:var(--font-display);font-size:1.15rem;font-weight:700;margin-bottom:0.5rem}
    .section p{color:var(--muted);font-size:0.9rem;line-height:1.6}

    footer{border-top:1px solid var(--line);padding:1.5rem 0;margin-top:2rem;text-align:center;font-size:0.8rem;color:var(--muted-soft)}
    footer a{color:var(--muted)}
  </style>
</head>
<body>
  <header>
    <div class="container">
      <a href="https://freebiostore.online" class="brand">
        <span class="brand-mark">🤖</span>
        <span style="display:flex;flex-direction:column">
          <span class="brand-name">AgentStore</span>
          <span class="brand-tag">Free AI Tools</span>
        </span>
      </a>
      <nav>
        <a href="https://freebiostore.online">Agents</a>
        <a href="https://freebiostore.online/skills.md">Docs</a>
        <a href="https://console.freebiostore.online">Console</a>
        <a href="https://github.com/FreeBioStore">GitHub</a>
        <a href="https://proagentstore.online" class="pro">Pro</a>
      </nav>
      <div id="auth-ui" style="margin-left:0.5rem;display:flex;align-items:center">
        <a href="/v1/auth/github" id="auth-login" style="display:none;padding:0.35rem 0.85rem;border-radius:8px;border:1px solid var(--line);color:var(--muted);font-size:0.82rem;font-weight:600;text-decoration:none;transition:border-color 0.15s,color 0.15s">Sign in</a>
        <div id="auth-user" style="display:none;align-items:center;gap:0.5rem">
          <img id="auth-avatar" src="" alt="" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--line)" />
          <button id="auth-signout" style="padding:0.25rem 0.6rem;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:0.72rem;cursor:pointer;font-family:inherit">Sign out</button>
        </div>
      </div>
    </div>
  </header>

  <main class="container">
    <a href="https://freebiostore.online" class="back">&larr; All agents</a>

    <div class="detail-split">
      <div>
        <!-- Hero -->
        <div class="hero">
          <div class="hero-icon" style="background:${agent.iconBg}">${agent.icon}</div>
          <div>
            <h1>${agent.name}</h1>
            <span class="cat${isHeuristic ? ' heuristic-cat' : ''}">${agent.category}${isHeuristic ? ' / heuristic' : ''}</span>
            <div class="dev">by <a href="/developers/${(agent.developer ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}/" style="color:var(--muted);text-decoration:underline">${agent.developer}</a></div>
          </div>
        </div>

        <!-- Description -->
        <p class="desc">${agent.description} Runs entirely in your browser — your data never leaves your device.</p>

        ${readmeHtml ? `<div class="readme" style="margin:1.5rem 0;padding:1.25rem;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius)"><h2 style="font-family:var(--font-display);font-size:1.1rem;margin-bottom:0.75rem">Documentation</h2>${readmeHtml}</div>` : ''}

        <!-- Badges -->
        <div class="badges">
          <span class="badge-pass"><span class="dot"></span> Free forever</span>
          ${agent.offlineCapable ? '<span class="badge-pass"><span class="dot"></span> Works offline</span>' : ''}
          <span class="badge-pass"><span class="dot"></span> 100% private</span>
          <span class="badge-pass"><span class="dot"></span> Open source (MIT)</span>
        </div>
        <div id="usage-stats"></div>

        <!-- Meta grid -->
        <div class="meta-grid">
          <div class="meta-item">
            <div class="label">Price</div>
            <div class="value">Free forever</div>
          </div>
          <div class="meta-item">
            <div class="label">Model</div>
            <div class="value">${agent.model ?? 'None'}</div>
          </div>
          <div class="meta-item">
            <div class="label">Download</div>
            <div class="value">${agent.modelSize ?? '0MB'}</div>
          </div>
          <div class="meta-item">
            <div class="label">Backends</div>
            <div class="value">${backends}</div>
          </div>
          <div class="meta-item">
            <div class="label">Offline</div>
            <div class="value">${agent.offlineCapable ? 'Yes' : 'No'}</div>
          </div>
          <div class="meta-item">
            <div class="label">Desktop only</div>
            <div class="value">${agent.desktopOnly ? 'Yes' : 'No'}</div>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions">
          <a href="${agent.agentUrl}" class="btn-primary" target="_blank" rel="noopener">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
            Open Agent
          </a>
          <a href="https://github.com/${repoPath}" class="btn-secondary" target="_blank" rel="noopener">View Source</a>
          <a href="https://console.freebiostore.online" class="btn-secondary">Console</a>
        </div>

        <!-- Use this agent -->
        <div class="section">
          <h2>Use this agent</h2>
          ${agent.api?.functions?.length
            ? `<div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:1rem;font-family:monospace;font-size:0.82rem;overflow-x:auto;margin-bottom:1rem">
            <div style="color:#a78bfa">${agent.api.imports}</div>
          </div>
          ${agent.api.functions.map(fn => `<div style="margin-bottom:1.25rem">
            <h3 style="font-family:var(--font-body);font-size:0.9rem;font-weight:600;margin-bottom:0.4rem;color:var(--ink)">${fn.name}</h3>
            <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:0.75rem;font-family:monospace;font-size:0.8rem;overflow-x:auto;margin-bottom:0.35rem">
              <div style="color:var(--muted)">${fn.signature}</div>
            </div>
            <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:0.75rem;font-family:monospace;font-size:0.8rem;overflow-x:auto;white-space:pre-wrap">${fn.example}</div>
          </div>`).join('')}
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:0.75rem;font-family:monospace;font-size:0.78rem;overflow-x:auto;color:var(--muted-soft)">
            <div style="margin-bottom:0.35rem"># npm / pnpm</div>
            <div style="color:var(--muted)">pnpm add ${agent.npmPkg ?? '@freebiostore/' + agent.id}</div>
            ${agent.noEsm ? '' : `<div style="margin-top:0.5rem"># or import directly (zero install)</div>
            <div style="color:var(--muted)">import { ... } from '${agent.esmUrl ?? 'https://freebiostore.online/pkg/' + agent.id + '/index.js'}'</div>`}
          </div>`
            : agent.api?.note
            ? `<p style="color:var(--muted);margin-bottom:0.75rem">${agent.api.note}</p>
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:0.75rem;font-family:monospace;font-size:0.78rem;overflow-x:auto;color:var(--muted-soft)">
            <div style="margin-bottom:0.35rem"># npm / pnpm</div>
            <div style="color:var(--muted)">pnpm add ${agent.npmPkg ?? '@freebiostore/' + agent.id}</div>
          </div>`
            : `<p style="margin-bottom:0.75rem">Add to any app via npm or import directly from URL — no install needed.</p>
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:1rem;font-family:monospace;font-size:0.82rem;overflow-x:auto">
            <div style="color:var(--muted-soft);margin-bottom:0.5rem"># npm / pnpm</div>
            <div>pnpm add ${agent.npmPkg ?? '@freebiostore/' + agent.id}</div>
            <div style="color:var(--muted-soft);margin-top:0.75rem"># or import directly (zero install)</div>
            <div style="color:#a78bfa">import { ... } from '${agent.esmUrl ?? 'https://freebiostore.online/pkg/' + agent.id + '/index.js'}'</div>
          </div>`
          }
        </div>

        <!-- Apps using this agent -->
        <div class="section">
          <h2>Apps using this agent</h2>
          ${(agent.usedByApps?.length > 0) ? agent.usedByApps.map(app => `
          <a href="${app.url}" style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem;border-radius:10px;background:var(--panel);border:1px solid var(--line);text-decoration:none;color:var(--ink);margin-bottom:0.5rem;transition:border-color 0.15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--line)'">
            <div style="flex:1">
              <div style="font-weight:600;font-size:0.9rem">${app.name}</div>
              <div style="font-size:0.78rem;color:var(--muted)">${app.description}</div>
            </div>
            <span style="font-size:0.72rem;color:var(--muted-soft);flex-shrink:0">${app.store} &rarr;</span>
          </a>`).join('') : `
          <p style="color:var(--muted)">No apps yet. <a href="https://freeappstore.online">Build one on FreeAppStore</a> and import <code style="background:var(--panel);padding:0.1rem 0.4rem;border-radius:4px;font-size:0.82rem">${agent.npmPkg ?? '@freebiostore/' + agent.id}</code>.</p>`}
        </div>

        <!-- About -->
        <div class="section">
          <h2>How it works</h2>
          ${isHeuristic
            ? '<p>This is a <strong>heuristic agent</strong> — pure JavaScript code evolved by an LLM from examples. No AI model at runtime. Instant results, zero download, works offline.</p>'
            : agent.type === 'built-in-ai'
            ? '<p>Uses <strong>Chrome Built-in AI</strong> (Gemini Nano) — a 4GB model pre-installed in your browser by Google. Zero download, instant inference, fully on-device. Falls back to Ollama if available. Requires Chrome 138+ or Edge with Aion.</p>'
            : `<p>Uses the <strong>${agent.model}</strong> model (${agent.modelSize}). Downloads once, cached in Cache Storage forever. Inference runs in a Web Worker via ${backends.includes('WEBGPU') ? 'WebGPU with WASM fallback' : 'WASM'}.</p>`
          }
          <p style="margin-top:0.5rem">100% private — no data leaves your browser. Open source (MIT). <a href="https://github.com/${repoPath}">View source</a>.</p>
        </div>

        ${!isHeuristic ? `
        <div class="section">
          <h2>Need server-side?</h2>
          <p><a href="https://proagentstore.online">ProAgentStore</a> — larger models, batch processing, cron, API access. $9/mo.</p>
        </div>` : ''}
      </div>

      <!-- Sandbox -->
      <aside>
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden">
          <div style="padding:0.75rem 1rem;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:0.5rem">
            <span style="font-size:0.85rem;font-weight:600">Sandbox</span>
            <span style="font-size:0.72rem;color:var(--muted)">Try it live</span>
          </div>
          <div id="sandbox" style="padding:1rem">
            ${generateSandbox(agent)}
          </div>
          <div style="padding:0.5rem 1rem;border-top:1px solid var(--line);font-size:0.72rem;color:var(--muted-soft);text-align:center">
            <a href="${agent.agentUrl}" style="color:var(--muted)">Open full app &rarr;</a>
          </div>
        </div>
      </aside>
    </div>

    <!-- README from repo -->
    <div id="readme" class="container" style="display:none;margin-top:2rem;padding-bottom:2rem">
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:1.5rem">
        <h2 style="font-family:var(--font-display);font-size:1.15rem;font-weight:700;margin-bottom:1rem">README</h2>
        <div id="readme-content" style="color:var(--muted);font-size:0.9rem;line-height:1.7"></div>
      </div>
    </div>
  </main>

  <footer>
    <div class="container">
      <a href="https://freebiostore.online">FreeBioStore</a> &middot;
      <a href="https://freebiostore.online/skills.md">Docs</a> &middot;
      <a href="https://github.com/FreeBioStore">GitHub</a> &middot;
      <a href="https://proagentstore.online" style="color:#3b82f6">Pro</a>
    </div>
  </footer>

  <script>
    (async function() {
      try {
        const r = await fetch('https://api.github.com/repos/FreeBioStore/${agent.id}/readme', {
          headers: { Accept: 'application/vnd.github.html+json' }
        });
        if (!r.ok) return;
        const html = await r.text();
        document.getElementById('readme-content').innerHTML = html;
        document.getElementById('readme').style.display = 'block';
      } catch {}
    })();
  <\/script>
  <script>
    (function() {
      if (location.search.includes('login=success') && location.hash.startsWith('#session=')) {
        var token = location.hash.slice('#session='.length);
        if (token) {
          localStorage.setItem('fags_session', JSON.stringify({ token: token }));
          history.replaceState(null, '', location.pathname);
          location.reload();
          return;
        }
      }
      var session = null;
      try {
        var stored = localStorage.getItem('fags_session');
        if (stored) session = JSON.parse(stored);
      } catch (_) {}
      var loginEl = document.getElementById('auth-login');
      var userEl = document.getElementById('auth-user');
      var avatarEl = document.getElementById('auth-avatar');
      var signoutEl = document.getElementById('auth-signout');
      if (session && session.token) {
        try {
          var parts = session.token.split('.');
          var payload = JSON.parse(atob(parts[0]));
          if (payload.exp && payload.exp < Date.now() / 1000) {
            localStorage.removeItem('fags_session');
            session = null;
          } else {
            avatarEl.src = payload.avatar || '';
            avatarEl.alt = payload.login || '';
            userEl.style.display = 'flex';
          }
        } catch (_) {
          localStorage.removeItem('fags_session');
          session = null;
        }
      }
      if (!session) loginEl.style.display = 'inline-block';
      signoutEl.addEventListener('click', function() {
        fetch('/v1/auth/logout', { method: 'POST' }).finally(function() {
          localStorage.removeItem('fags_session');
          location.reload();
        });
      });
    })();
  <\/script>
  <script>
    fetch('/v1/stats/${agent.id}').then(function(r){return r.json()}).then(function(d){
      if(d.calls>0){document.getElementById('usage-stats').innerHTML='<span style="font-size:0.82rem;color:#a3a3a3">'+d.calls+' API calls</span>';}
    }).catch(function(){});
  <\/script>
</body>
</html>`;
}

function generateSandbox(agent) {
  // Config-driven sandbox (presets with structured output) — e.g. summarizer
  if (agent.sandbox?.type === 'config-driven') {
    return generateConfigSandbox(agent);
  }

  const esmUrl = agent.esmUrl ?? `https://freebiostore.online/pkg/${agent.id}/index.js`;

  // ── Live sandboxes for agents with api.functions (only if ESM is available) ──
  if (agent.api?.functions?.length && !agent.noEsm) {
    return generateLiveSandbox(agent, esmUrl);
  }

  // ── Model/built-in agents with api.functions but no ESM — show link to full app ──
  if (agent.api?.functions?.length && agent.noEsm) {
    return generateNoteSandbox(agent);
  }

  // ── Link/iframe sandboxes for agents with api.note ──
  if (agent.api?.note) {
    return generateNoteSandbox(agent);
  }

  // ── Legacy form-based sandbox for agents with sandbox.methods ──
  if (agent.sandbox?.methods?.length) {
    return generateMethodSandbox(agent, esmUrl);
  }

  return `<p style="color:var(--muted);font-size:0.85rem">Sandbox coming soon. <a href="${agent.agentUrl}">Try the full app</a>.</p>`;
}

// ── Per-agent sandbox renderers ──────────────────────────────────────

const LIVE_SANDBOX_CONFIGS = {
  sentiment: {
    inputType: 'textarea',
    placeholder: 'Type something to analyze...',
    samples: [
      'This product is amazing and works perfectly!',
      'Terrible service, waste of money',
      "It's okay, nothing special",
      'I absolutely love how easy this is to use',
      'Not great, not terrible'
    ],
    fn: 'analyzeSentiment',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">No result</span>';
      var colors = { positive: '#4ade80', negative: '#f87171', neutral: '#a3a3a3' };
      var c = colors[r.sentiment] || '#a3a3a3';
      var pct = Math.round((r.confidence ?? 0) * 100);
      return '<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">'
        + '<span style="font-size:1.5rem;font-weight:700;color:' + c + ';text-transform:uppercase">' + (r.sentiment || '?') + '</span>'
        + '<span style="font-size:0.82rem;color:var(--muted)">score: ' + (r.score ?? 0).toFixed(2) + '</span>'
        + '</div>'
        + '<div style="font-size:0.72rem;color:var(--muted-soft);margin-bottom:0.25rem">Confidence</div>'
        + '<div style="background:var(--line);border-radius:4px;height:8px;overflow:hidden">'
        + '<div style="width:' + pct + '%;height:100%;background:' + c + ';border-radius:4px;transition:width 0.3s"></div>'
        + '</div>'
        + '<div style="text-align:right;font-size:0.72rem;color:var(--muted-soft);margin-top:0.15rem">' + pct + '%</div>';
    }`
  },

  'emotion-detector': {
    inputType: 'textarea',
    placeholder: 'Type something to detect emotions...',
    samples: [
      "I'm thrilled about this promotion!",
      'This makes me furious',
      "I'm worried about the deadline",
      'What a wonderful surprise!',
      'I feel so lonely today'
    ],
    fn: 'detectEmotions',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">No result</span>';
      var emotionColors = { joy:'#facc15', anger:'#ef4444', sadness:'#3b82f6', fear:'#a855f7', surprise:'#f97316', disgust:'#22c55e', trust:'#06b6d4', anticipation:'#ec4899' };
      var c = emotionColors[r.primary] || '#a3a3a3';
      var html = '<div style="font-size:1.1rem;font-weight:700;color:' + c + ';margin-bottom:0.75rem">' + (r.primary || '?') + (r.compound ? ' <span style="font-size:0.78rem;font-weight:400;color:var(--muted)">(' + r.compound + ')</span>' : '') + '</div>';
      var scores = r.scores || {};
      var keys = Object.keys(scores).sort(function(a,b){ return scores[b] - scores[a]; });
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i]; var v = scores[k]; var pct = Math.round(v * 100);
        var bc = emotionColors[k] || '#737373';
        html += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem">'
          + '<span style="width:75px;font-size:0.72rem;color:var(--muted);text-align:right">' + k + '</span>'
          + '<div style="flex:1;background:var(--line);border-radius:3px;height:6px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + bc + ';border-radius:3px"></div></div>'
          + '<span style="width:28px;font-size:0.68rem;color:var(--muted-soft)">' + pct + '%</span></div>';
      }
      return html;
    }`
  },

  'language-detector': {
    inputType: 'textarea',
    placeholder: 'Type text in any language...',
    samples: [
      'Bonjour le monde',
      'Hallo Welt, wie geht es dir?',
      '\u3053\u3093\u306b\u3061\u306f\u4e16\u754c',
      'Hola, como estas hoy?',
      '\u041f\u0440\u0438\u0432\u0435\u0442 \u043c\u0438\u0440'
    ],
    fn: 'detectLanguage',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">No result</span>';
      var flags = {en:'\ud83c\uddfa\ud83c\uddf8',fr:'\ud83c\uddeb\ud83c\uddf7',de:'\ud83c\udde9\ud83c\uddea',es:'\ud83c\uddea\ud83c\uddf8',it:'\ud83c\uddee\ud83c\uddf9',pt:'\ud83c\uddf5\ud83c\uddf9',ja:'\ud83c\uddef\ud83c\uddf5',ko:'\ud83c\uddf0\ud83c\uddf7',zh:'\ud83c\udde8\ud83c\uddf3',ru:'\ud83c\uddf7\ud83c\uddfa',ar:'\ud83c\uddf8\ud83c\udde6',hi:'\ud83c\uddee\ud83c\uddf3',nl:'\ud83c\uddf3\ud83c\uddf1',sv:'\ud83c\uddf8\ud83c\uddea',pl:'\ud83c\uddf5\ud83c\uddf1',tr:'\ud83c\uddf9\ud83c\uddf7',vi:'\ud83c\uddfb\ud83c\uddf3',th:'\ud83c\uddf9\ud83c\udded',uk:'\ud83c\uddfa\ud83c\udde6',cs:'\ud83c\udde8\ud83c\uddff',ro:'\ud83c\uddf7\ud83c\uddf4',da:'\ud83c\udde9\ud83c\uddf0',fi:'\ud83c\uddeb\ud83c\uddee',el:'\ud83c\uddec\ud83c\uddf7',hu:'\ud83c\udded\ud83c\uddfa',no:'\ud83c\uddf3\ud83c\uddf4',id:'\ud83c\uddee\ud83c\udde9',ms:'\ud83c\uddf2\ud83c\uddfe',tl:'\ud83c\uddf5\ud83c\udded'};
      var flag = flags[r.language] || '\ud83c\uddf7\ud83c\uddfa';
      var pct = Math.round((r.confidence ?? 0) * 100);
      var html = '<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">'
        + '<span style="font-size:2rem">' + flag + '</span>'
        + '<div><div style="font-size:1.1rem;font-weight:700;color:var(--ink)">' + (r.languageName || r.language || '?') + '</div>'
        + '<div style="font-size:0.72rem;color:var(--muted)">' + (r.language || '') + '</div></div></div>'
        + '<div style="font-size:0.72rem;color:var(--muted-soft);margin-bottom:0.25rem">Confidence</div>'
        + '<div style="background:var(--line);border-radius:4px;height:8px;overflow:hidden">'
        + '<div style="width:' + pct + '%;height:100%;background:var(--accent);border-radius:4px;transition:width 0.3s"></div></div>'
        + '<div style="text-align:right;font-size:0.72rem;color:var(--muted-soft);margin-top:0.15rem">' + pct + '%</div>';
      if (r.scores && r.scores.length > 1) {
        html += '<div style="margin-top:0.75rem;font-size:0.72rem;color:var(--muted-soft)">Top candidates:</div>';
        var top = r.scores.slice(0, 3);
        for (var i = 0; i < top.length; i++) {
          var s = top[i]; var sp = Math.round((s.confidence ?? s.score ?? 0) * 100);
          var sf = flags[s.language] || '';
          html += '<div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.2rem;font-size:0.78rem;color:var(--muted)">'
            + sf + ' ' + (s.languageName || s.language) + ' <span style="color:var(--muted-soft)">' + sp + '%</span></div>';
        }
      }
      return html;
    }`
  },

  'date-parser': {
    inputType: 'input',
    placeholder: 'e.g. next tuesday, March 14 2025, in 3 weeks...',
    samples: [
      'next tuesday',
      'March 14, 2025',
      'in 3 weeks',
      '2025-03-14T10:30:00Z',
      'last friday'
    ],
    fn: 'parseDate',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">Could not parse date</span>';
      var html = '<div style="display:grid;grid-template-columns:auto 1fr;gap:0.3rem 0.75rem;font-size:0.85rem">';
      var fields = [
        ['Formatted', r.formatted],
        ['ISO', r.iso],
        ['Relative', r.relative],
        ['Confidence', r.confidence ? Math.round(r.confidence * 100) + '%' : null]
      ];
      for (var i = 0; i < fields.length; i++) {
        if (!fields[i][1]) continue;
        html += '<div style="color:var(--muted-soft);font-size:0.72rem;text-transform:uppercase;font-weight:600;padding-top:0.15rem">' + fields[i][0] + '</div>'
          + '<div style="color:var(--ink)">' + fields[i][1] + '</div>';
      }
      html += '</div>';
      if (r.format) {
        html += '<div style="margin-top:0.5rem"><span style="font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:4px;background:rgba(124,58,237,0.15);color:#a78bfa">' + r.format + '</span></div>';
      }
      return html;
    }`
  },

  'address-parser': {
    inputType: 'textarea',
    placeholder: 'Enter an address...',
    samples: [
      '123 Main St, San Francisco, CA 94102',
      '10 Downing Street, London SW1A 2AA',
      '1600 Pennsylvania Avenue NW, Washington, DC 20500'
    ],
    fn: 'parseAddress',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">Could not parse address</span>';
      var fields = ['street','unit','city','state','zip','country','format'];
      var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem">';
      for (var i = 0; i < fields.length; i++) {
        var v = r[fields[i]];
        if (!v) continue;
        html += '<div style="background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:0.4rem 0.6rem">'
          + '<div style="font-size:0.65rem;color:var(--muted-soft);text-transform:uppercase;font-weight:600">' + fields[i] + '</div>'
          + '<div style="font-size:0.85rem;color:var(--ink)">' + v + '</div></div>';
      }
      html += '</div>';
      return html;
    }`
  },

  'name-parser': {
    inputType: 'input',
    placeholder: 'e.g. Dr. Maria Garcia-Lopez Jr.',
    samples: [
      'Dr. Mar\u00eda Jos\u00e9 Garc\u00eda-L\u00f3pez III',
      'Kim Jong-un',
      'Bj\u00f6rk',
      'Sir Patrick Stewart',
      'Mary Jane Watson-Parker'
    ],
    fn: 'parseName',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">Could not parse name</span>';
      var parts = [
        { label: 'prefix', value: r.prefix, color: '#f59e0b' },
        { label: 'first', value: r.first, color: '#3b82f6' },
        { label: 'middle', value: r.middle, color: '#8b5cf6' },
        { label: 'last', value: r.last, color: '#22c55e' },
        { label: 'suffix', value: r.suffix, color: '#ef4444' }
      ];
      var html = '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.5rem">';
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i].value) continue;
        html += '<div style="background:' + parts[i].color + '22;border:1px solid ' + parts[i].color + '44;border-radius:6px;padding:0.35rem 0.6rem;text-align:center">'
          + '<div style="font-size:0.62rem;color:' + parts[i].color + ';text-transform:uppercase;font-weight:600;margin-bottom:0.1rem">' + parts[i].label + '</div>'
          + '<div style="font-size:0.9rem;color:var(--ink)">' + parts[i].value + '</div></div>';
      }
      html += '</div>';
      if (r.format) html += '<span style="font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:4px;background:var(--line);color:var(--muted)">' + r.format + '</span>';
      return html;
    }`
  },

  'email-classifier': {
    inputType: 'dual', // subject + body
    placeholder: 'Email body...',
    placeholderSubject: 'Email subject...',
    samples: [
      { subject: 'Your order has shipped', body: 'Tracking number: 1Z999AA10123456784. Expected delivery: Friday.' },
      { subject: 'Flash Sale - 50% Off Everything!', body: 'Limited time offer. Use code SAVE50 at checkout.' },
      { subject: 'Hey, are we still on for dinner?', body: 'Let me know if 7pm works. I was thinking Italian.' }
    ],
    fn: 'classifyEmail',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">No result</span>';
      var catColors = { transactional:'#3b82f6', promotional:'#f59e0b', personal:'#22c55e', notification:'#8b5cf6', newsletter:'#06b6d4', spam:'#ef4444', social:'#ec4899' };
      var c = catColors[r.category] || '#a3a3a3';
      var pct = Math.round((r.confidence ?? 0) * 100);
      var html = '<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">'
        + '<span style="font-size:0.88rem;font-weight:700;padding:0.3rem 0.8rem;border-radius:8px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;text-transform:uppercase">' + (r.category || '?') + '</span></div>'
        + '<div style="font-size:0.72rem;color:var(--muted-soft);margin-bottom:0.25rem">Confidence</div>'
        + '<div style="background:var(--line);border-radius:4px;height:8px;overflow:hidden">'
        + '<div style="width:' + pct + '%;height:100%;background:' + c + ';border-radius:4px;transition:width 0.3s"></div></div>'
        + '<div style="text-align:right;font-size:0.72rem;color:var(--muted-soft);margin-top:0.15rem">' + pct + '%</div>';
      if (r.signals && r.signals.length) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.5rem">';
        for (var i = 0; i < r.signals.length; i++) {
          html += '<span style="font-size:0.68rem;padding:0.15rem 0.45rem;border-radius:4px;background:var(--line);color:var(--muted)">' + r.signals[i] + '</span>';
        }
        html += '</div>';
      }
      return html;
    }`
  },

  'profanity-filter': {
    inputType: 'textarea',
    placeholder: 'Type text to check...',
    samples: [
      'What a beautiful day!',
      'What the hell is going on',
      'The donkey kicked the bucket',
      'This is absolutely wonderful',
      'Go to hell you jerk'
    ],
    fn: 'checkProfanity',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">No result</span>';
      var sevColors = { none:'#4ade80', mild:'#facc15', moderate:'#f97316', severe:'#ef4444' };
      var sev = r.severity || (r.flagged ? 'mild' : 'none');
      var c = sevColors[sev] || '#a3a3a3';
      var html = '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem">'
        + '<span style="font-size:0.82rem;font-weight:700;padding:0.25rem 0.65rem;border-radius:6px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;text-transform:uppercase">' + sev + '</span>'
        + '<span style="font-size:0.78rem;color:var(--muted)">' + (r.flagged ? 'Flagged' : 'Clean') + '</span></div>';
      if (r.cleaned) {
        html += '<div style="font-size:0.72rem;color:var(--muted-soft);margin-bottom:0.25rem">Cleaned text</div>'
          + '<div style="background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:0.5rem;font-size:0.85rem;color:var(--ink)">' + r.cleaned + '</div>';
      }
      return html;
    }`
  },

  'code-detector': {
    inputType: 'textarea',
    inputStyle: 'font-family:monospace',
    placeholder: 'Paste code to detect language...',
    samples: [
      'const x: number = 42;',
      "def hello():\n  print('hi')",
      'SELECT * FROM users WHERE active = 1'
    ],
    fn: 'detectLanguage',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">Could not detect language</span>';
      var pct = Math.round((r.confidence ?? 0) * 100);
      var html = '<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">'
        + '<div style="font-size:1.1rem;font-weight:700;color:var(--ink)">' + (r.language || '?') + '</div>'
        + '<span style="font-size:0.72rem;padding:0.15rem 0.5rem;border-radius:4px;background:var(--line);color:var(--muted)">' + (r.fileExtension || '') + '</span></div>'
        + '<div style="font-size:0.72rem;color:var(--muted-soft);margin-bottom:0.25rem">Confidence</div>'
        + '<div style="background:var(--line);border-radius:4px;height:8px;overflow:hidden">'
        + '<div style="width:' + pct + '%;height:100%;background:var(--accent);border-radius:4px;transition:width 0.3s"></div></div>'
        + '<div style="text-align:right;font-size:0.72rem;color:var(--muted-soft);margin-top:0.15rem">' + pct + '%</div>';
      return html;
    }`
  },

  'resume-parser': {
    inputType: 'textarea',
    placeholder: 'Paste resume text...',
    samples: [
      "John Smith\njohn@email.com | (415) 555-1234\n\nExperience\nSenior Engineer at Acme Corp\nJan 2021 - Present\n- Built scalable APIs\n\nSkills\nJavaScript, React, Node.js, Python\n\nEducation\nBS Computer Science - Stanford University\n2014 - 2018"
    ],
    fn: 'parseResume',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">Could not parse resume</span>';
      var html = '';
      if (r.name) html += '<div style="font-size:1.1rem;font-weight:700;color:var(--ink);margin-bottom:0.2rem">' + r.name + '</div>';
      if (r.email) html += '<div style="font-size:0.82rem;color:var(--accent);margin-bottom:0.5rem">' + r.email + '</div>';
      if (r.phone) html += '<div style="font-size:0.82rem;color:var(--muted);margin-bottom:0.5rem">' + r.phone + '</div>';
      if (r.skills && r.skills.length) {
        html += '<div style="font-size:0.72rem;color:var(--muted-soft);text-transform:uppercase;font-weight:600;margin-bottom:0.3rem">Skills</div>'
          + '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.5rem">';
        for (var i = 0; i < r.skills.length; i++) {
          html += '<span style="font-size:0.72rem;padding:0.15rem 0.5rem;border-radius:4px;background:rgba(124,58,237,0.15);color:#a78bfa">' + r.skills[i] + '</span>';
        }
        html += '</div>';
      }
      if (r.experience && r.experience.length) {
        html += '<div style="font-size:0.72rem;color:var(--muted-soft);text-transform:uppercase;font-weight:600;margin-bottom:0.3rem">Experience</div>';
        for (var i = 0; i < r.experience.length; i++) {
          var exp = r.experience[i];
          var title = typeof exp === 'string' ? exp : (exp.title || exp.role || '') + (exp.company ? ' at ' + exp.company : '');
          html += '<div style="font-size:0.82rem;color:var(--ink);margin-bottom:0.2rem">' + title + '</div>';
        }
      }
      if (r.education && r.education.length) {
        html += '<div style="font-size:0.72rem;color:var(--muted-soft);text-transform:uppercase;font-weight:600;margin-top:0.4rem;margin-bottom:0.3rem">Education</div>';
        for (var i = 0; i < r.education.length; i++) {
          var edu = r.education[i];
          var label = typeof edu === 'string' ? edu : (edu.degree || '') + (edu.school ? ' - ' + edu.school : '');
          html += '<div style="font-size:0.82rem;color:var(--ink);margin-bottom:0.2rem">' + label + '</div>';
        }
      }
      return html || '<pre style="color:var(--muted)">' + JSON.stringify(r, null, 2) + '</pre>';
    }`
  },

  'unit-converter': {
    inputType: 'converter', // special: number + two dropdowns
    samples: [
      { value: 100, from: 'km', to: 'mi' },
      { value: 72, from: 'f', to: 'c' },
      { value: 1, from: 'kg', to: 'lb' }
    ],
    fn: 'convert',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">No result</span>';
      if (r.error) return '<span style="color:#f87171">' + r.error + '</span>';
      return '<div style="font-size:1.3rem;font-weight:700;color:var(--ink);margin-bottom:0.3rem">' + (typeof r.result === 'number' ? r.result.toFixed(6).replace(/\\.?0+$/, '') : r.result) + '</div>'
        + (r.formatted ? '<div style="font-size:0.82rem;color:var(--muted)">' + r.formatted + '</div>' : '');
    }`
  },

  'regex-builder': {
    inputType: 'input',
    placeholder: 'Describe a pattern, e.g. "email address"...',
    samples: [
      'email address',
      'phone number',
      'URL',
      'IP address',
      'date'
    ],
    fn: 'matchPattern',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">No patterns found</span>';
      var arr = Array.isArray(r) ? r : [r];
      if (!arr.length) return '<span style="color:var(--muted)">No patterns found</span>';
      var html = '';
      for (var i = 0; i < arr.length; i++) {
        var p = arr[i];
        html += '<div style="margin-bottom:0.75rem;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:0.6rem">'
          + '<div style="font-size:0.82rem;font-weight:600;color:var(--ink);margin-bottom:0.3rem">' + (p.name || 'Pattern') + '</div>'
          + '<div style="display:flex;align-items:center;gap:0.4rem">'
          + '<code style="flex:1;font-family:monospace;font-size:0.78rem;color:#a78bfa;word-break:break-all">' + (p.regex || p) + '</code>'
          + '<button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent);this.textContent=\\'Copied!\\';setTimeout(function(){this.textContent=\\'Copy\\'},1000)" style="padding:0.2rem 0.5rem;border-radius:4px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:0.68rem;cursor:pointer;flex-shrink:0">Copy</button>'
          + '</div></div>';
      }
      return html;
    }`
  },

  'json-formatter': {
    inputType: 'textarea',
    inputStyle: 'font-family:monospace',
    placeholder: 'Paste JSON here...',
    samples: [
      '{"name":"Alice","age":30,"hobbies":["reading","coding"]}',
      '{"users":[{"id":1,"active":true},{"id":2,"active":false}]}',
      '[1,2,3,{"nested":true}]'
    ],
    fn: 'formatJson',
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">No result</span>';
      if (r.error) return '<span style="color:#f87171">' + r.error + '</span>';
      var text = r.result || r;
      var escaped = String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var highlighted = escaped
        .replace(/"([^"]*)"\\s*:/g, '<span style="color:#a78bfa">"$1"</span>:')
        .replace(/:\\s*"([^"]*)"/g, ': <span style="color:#4ade80">"$1"</span>')
        .replace(/:\\s*(\\d+\\.?\\d*)/g, ': <span style="color:#60a5fa">$1</span>')
        .replace(/:\\s*(true|false|null)/g, ': <span style="color:#f59e0b">$1</span>');
      return '<pre style="font-family:monospace;font-size:0.78rem;white-space:pre-wrap;word-break:break-word;margin:0;max-height:300px;overflow-y:auto">' + highlighted + '</pre>';
    }`
  },

  'hash-generator': {
    inputType: 'input',
    placeholder: 'Type text to hash...',
    samples: [
      'hello world',
      'freebiostore',
      'The quick brown fox'
    ],
    fn: 'sha256',
    isAsync: true,
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">No result</span>';
      return '<div style="font-size:0.72rem;color:var(--muted-soft);margin-bottom:0.25rem">SHA-256</div>'
        + '<div style="display:flex;align-items:center;gap:0.4rem">'
        + '<code style="flex:1;font-family:monospace;font-size:0.75rem;color:var(--ink);word-break:break-all">' + r + '</code>'
        + '<button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent);this.textContent=\\'Copied!\\';var b=this;setTimeout(function(){b.textContent=\\'Copy\\'},1000)" style="padding:0.2rem 0.5rem;border-radius:4px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:0.68rem;cursor:pointer;flex-shrink:0">Copy</button>'
        + '</div>';
    }`
  },

  'name-generator': {
    inputType: 'generator', // pills + button
    samples: [], // not used — has genre pills instead
    fn: 'generateName',
    needsButton: true,
    render: `function renderResult(r) {
      if (!r) return '<span style="color:var(--muted)">No result</span>';
      var html = '<div style="font-size:1.2rem;font-weight:700;color:var(--ink);margin-bottom:0.15rem">' + (r.full || r.name || '?') + '</div>';
      if (r.epithet) html += '<div style="font-size:0.85rem;color:var(--muted);font-style:italic;margin-bottom:0.3rem">' + r.epithet + '</div>';
      var parts = [];
      if (r.name) parts.push(['Name', r.name]);
      if (r.surname) parts.push(['Surname', r.surname]);
      if (parts.length) {
        html += '<div style="display:flex;gap:0.4rem;margin-top:0.4rem">';
        for (var i = 0; i < parts.length; i++) {
          html += '<div style="background:rgba(124,58,237,0.15);border-radius:6px;padding:0.3rem 0.6rem">'
            + '<div style="font-size:0.62rem;color:var(--muted-soft);text-transform:uppercase;font-weight:600">' + parts[i][0] + '</div>'
            + '<div style="font-size:0.85rem;color:var(--ink)">' + parts[i][1] + '</div></div>';
        }
        html += '</div>';
      }
      return html;
    }`
  }
};

// Canvas/interactive agents that should show an iframe preview
const IFRAME_AGENTS = new Set(['steering', 'behavior-tree', 'physics-sim']);

function generateLiveSandbox(agent, esmUrl) {
  const config = LIVE_SANDBOX_CONFIGS[agent.id];

  // If no custom config, fall back to a generic auto-run sandbox
  if (!config) {
    return generateGenericLiveSandbox(agent, esmUrl);
  }

  // ── Special: name-generator (needs a button, genre pills) ──
  if (config.inputType === 'generator') {
    return generateNameGeneratorSandbox(agent, esmUrl, config);
  }

  // ── Special: unit-converter (number + two dropdowns) ──
  if (config.inputType === 'converter') {
    return generateConverterSandbox(agent, esmUrl, config);
  }

  // ── Special: email-classifier (dual inputs) ──
  if (config.inputType === 'dual') {
    return generateDualInputSandbox(agent, esmUrl, config);
  }

  // ── Standard: single input (textarea or input), auto-run on type ──
  const isTextarea = config.inputType === 'textarea';
  const extraStyle = config.inputStyle ? `;${config.inputStyle}` : '';

  const samplesJson = JSON.stringify(config.samples).replace(/'/g, "\\'").replace(/<\//g, '<\\/');

  const inputEl = isTextarea
    ? `<textarea id="sb-input" rows="3" placeholder="${config.placeholder}" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:0.85rem;resize:vertical;font-family:inherit${extraStyle}"></textarea>`
    : `<input type="text" id="sb-input" placeholder="${config.placeholder}" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:0.85rem;font-family:inherit${extraStyle}" />`;

  return `
    <div style="margin-bottom:0.5rem">
      <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.5rem">
        ${config.samples.map((s, i) => `<button class="sb-sample" data-i="${i}" style="padding:0.25rem 0.6rem;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:0.72rem;cursor:pointer;font-family:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${escapeHtml(typeof s === 'string' ? s : s.text).slice(0, 30)}${(typeof s === 'string' ? s : s.text).length > 30 ? '...' : ''}</button>`).join('\n        ')}
      </div>
      ${inputEl}
    </div>
    <div id="sb-output" style="background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:0.75rem;min-height:3rem;color:var(--muted);font-size:0.85rem">Type above to try</div>
    <div id="sb-error" style="display:none;margin-top:0.35rem;padding:0.5rem;border-radius:6px;background:rgba(239,68,68,0.1);color:#f87171;font-size:0.78rem"></div>

    <script type="module">
      var _samples = ${samplesJson};
      ${config.render}

      var _mod, _loaded = false, _err = null;
      try {
        _mod = await import('${esmUrl}');
        _loaded = true;
      } catch(e) {
        _err = e;
        document.getElementById('sb-error').style.display = 'block';
        document.getElementById('sb-error').textContent = 'Module not deployed yet. Check back soon.';
      }

      var _timer;
      var input = document.getElementById('sb-input');
      var output = document.getElementById('sb-output');

      function run() {
        if (!_loaded) return;
        var v = input.value;
        if (!v.trim()) { output.innerHTML = '<span style="color:var(--muted)">Type above to try</span>'; return; }
        try {
          var result = _mod.${config.fn}(v);
          if (result && typeof result.then === 'function') {
            result.then(function(r) { output.innerHTML = renderResult(r); })
              .catch(function(e) { output.innerHTML = '<span style="color:#f87171">Error: ' + e.message + '</span>'; });
          } else {
            output.innerHTML = renderResult(result);
          }
        } catch(e) {
          output.innerHTML = '<span style="color:#f87171">Error: ' + e.message + '</span>';
        }
      }

      input.addEventListener('input', function() {
        clearTimeout(_timer);
        _timer = setTimeout(run, 200);
      });

      document.querySelectorAll('.sb-sample').forEach(function(btn) {
        btn.addEventListener('click', function() {
          input.value = _samples[Number(this.dataset.i)];
          input.dispatchEvent(new Event('input'));
        });
      });
    <\/script>`;
}

function generateDualInputSandbox(agent, esmUrl, config) {
  const samplesJson = JSON.stringify(config.samples).replace(/'/g, "\\'").replace(/<\//g, '<\\/');

  return `
    <div style="margin-bottom:0.5rem">
      <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.5rem">
        ${config.samples.map((s, i) => `<button class="sb-sample" data-i="${i}" style="padding:0.25rem 0.6rem;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:0.72rem;cursor:pointer;font-family:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">${escapeHtml(s.subject).slice(0, 30)}</button>`).join('\n        ')}
      </div>
      <label style="font-size:0.72rem;color:var(--muted-soft);display:block;margin-bottom:0.2rem">Subject</label>
      <input type="text" id="sb-subject" placeholder="${config.placeholderSubject}" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:0.85rem;font-family:inherit;margin-bottom:0.4rem" />
      <label style="font-size:0.72rem;color:var(--muted-soft);display:block;margin-bottom:0.2rem">Body</label>
      <textarea id="sb-body" rows="3" placeholder="${config.placeholder}" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:0.85rem;resize:vertical;font-family:inherit"></textarea>
    </div>
    <div id="sb-output" style="background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:0.75rem;min-height:3rem;color:var(--muted);font-size:0.85rem">Fill in subject and body to classify</div>
    <div id="sb-error" style="display:none;margin-top:0.35rem;padding:0.5rem;border-radius:6px;background:rgba(239,68,68,0.1);color:#f87171;font-size:0.78rem"></div>

    <script type="module">
      var _samples = ${samplesJson};
      ${config.render}

      var _mod, _loaded = false;
      try {
        _mod = await import('${esmUrl}');
        _loaded = true;
      } catch(e) {
        document.getElementById('sb-error').style.display = 'block';
        document.getElementById('sb-error').textContent = 'Module not deployed yet. Check back soon.';
      }

      var _timer;
      var subj = document.getElementById('sb-subject');
      var body = document.getElementById('sb-body');
      var output = document.getElementById('sb-output');

      function run() {
        if (!_loaded) return;
        var s = subj.value, b = body.value;
        if (!s.trim() && !b.trim()) { output.innerHTML = '<span style="color:var(--muted)">Fill in subject and body to classify</span>'; return; }
        try {
          var result = _mod.${config.fn}(s, b);
          if (result && typeof result.then === 'function') {
            result.then(function(r) { output.innerHTML = renderResult(r); })
              .catch(function(e) { output.innerHTML = '<span style="color:#f87171">Error: ' + e.message + '</span>'; });
          } else {
            output.innerHTML = renderResult(result);
          }
        } catch(e) {
          output.innerHTML = '<span style="color:#f87171">Error: ' + e.message + '</span>';
        }
      }

      subj.addEventListener('input', function() { clearTimeout(_timer); _timer = setTimeout(run, 200); });
      body.addEventListener('input', function() { clearTimeout(_timer); _timer = setTimeout(run, 200); });

      document.querySelectorAll('.sb-sample').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var s = _samples[Number(this.dataset.i)];
          subj.value = s.subject;
          body.value = s.body;
          run();
        });
      });
    <\/script>`;
}

function generateConverterSandbox(agent, esmUrl, config) {
  const samplesJson = JSON.stringify(config.samples).replace(/'/g, "\\'").replace(/<\//g, '<\\/');

  return `
    <div style="margin-bottom:0.5rem">
      <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.5rem">
        ${config.samples.map((s, i) => `<button class="sb-sample" data-i="${i}" style="padding:0.25rem 0.6rem;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:0.72rem;cursor:pointer;font-family:inherit">${s.value} ${s.from} → ${s.to}</button>`).join('\n        ')}
      </div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:0.4rem;align-items:end;margin-bottom:0.4rem">
        <div>
          <label style="font-size:0.68rem;color:var(--muted-soft);display:block;margin-bottom:0.2rem">Value</label>
          <input type="number" id="sb-value" value="100" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:0.85rem" />
        </div>
        <div style="padding-bottom:0.25rem;color:var(--muted-soft);font-size:0.82rem">→</div>
        <div style="display:flex;gap:0.3rem">
          <div style="flex:1">
            <label style="font-size:0.68rem;color:var(--muted-soft);display:block;margin-bottom:0.2rem">From</label>
            <input type="text" id="sb-from" value="km" placeholder="km" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:0.85rem" />
          </div>
          <div style="flex:1">
            <label style="font-size:0.68rem;color:var(--muted-soft);display:block;margin-bottom:0.2rem">To</label>
            <input type="text" id="sb-to" value="mi" placeholder="mi" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:0.85rem" />
          </div>
        </div>
      </div>
    </div>
    <div id="sb-output" style="background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:0.75rem;min-height:3rem;color:var(--muted);font-size:0.85rem">Enter values to convert</div>
    <div id="sb-error" style="display:none;margin-top:0.35rem;padding:0.5rem;border-radius:6px;background:rgba(239,68,68,0.1);color:#f87171;font-size:0.78rem"></div>

    <script type="module">
      var _samples = ${samplesJson};
      ${config.render}

      var _mod, _loaded = false;
      try {
        _mod = await import('${esmUrl}');
        _loaded = true;
      } catch(e) {
        document.getElementById('sb-error').style.display = 'block';
        document.getElementById('sb-error').textContent = 'Module not deployed yet. Check back soon.';
      }

      var _timer;
      var vEl = document.getElementById('sb-value');
      var fEl = document.getElementById('sb-from');
      var tEl = document.getElementById('sb-to');
      var output = document.getElementById('sb-output');

      function run() {
        if (!_loaded) return;
        var v = Number(vEl.value), f = fEl.value.trim(), t = tEl.value.trim();
        if (isNaN(v) || !f || !t) return;
        try {
          var result = _mod.${config.fn}(v, f, t);
          if (result && typeof result.then === 'function') {
            result.then(function(r) { output.innerHTML = renderResult(r); })
              .catch(function(e) { output.innerHTML = '<span style="color:#f87171">Error: ' + e.message + '</span>'; });
          } else {
            output.innerHTML = renderResult(result);
          }
        } catch(e) {
          output.innerHTML = '<span style="color:#f87171">Error: ' + e.message + '</span>';
        }
      }

      [vEl, fEl, tEl].forEach(function(el) {
        el.addEventListener('input', function() { clearTimeout(_timer); _timer = setTimeout(run, 200); });
      });

      document.querySelectorAll('.sb-sample').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var s = _samples[Number(this.dataset.i)];
          vEl.value = s.value; fEl.value = s.from; tEl.value = s.to;
          run();
        });
      });

      // Auto-run with defaults
      setTimeout(run, 300);
    <\/script>`;
}

function generateNameGeneratorSandbox(agent, esmUrl, config) {
  const genres = ['Fantasy', 'Sci-Fi', 'Medieval', 'Japanese', 'Nordic', 'Arabic'];
  const genders = ['Any', 'Male', 'Female'];

  return `
    <div style="margin-bottom:0.5rem">
      <div style="font-size:0.72rem;color:var(--muted-soft);margin-bottom:0.3rem;font-weight:600">Genre</div>
      <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.5rem">
        ${genres.map((g, i) => `<button class="sb-genre" data-v="${g.toLowerCase()}" style="padding:0.3rem 0.65rem;border-radius:6px;border:1px solid ${i === 0 ? 'var(--accent)' : 'var(--line)'};background:${i === 0 ? 'var(--accent)' : 'transparent'};color:${i === 0 ? '#fff' : 'var(--muted)'};font-size:0.78rem;cursor:pointer;font-family:inherit;font-weight:${i === 0 ? '600' : '400'}">${g}</button>`).join('\n        ')}
      </div>
      <div style="font-size:0.72rem;color:var(--muted-soft);margin-bottom:0.3rem;font-weight:600">Gender</div>
      <div style="display:flex;gap:0.3rem;margin-bottom:0.75rem">
        ${genders.map((g, i) => `<button class="sb-gender" data-v="${g === 'Any' ? '' : g.toLowerCase()}" style="padding:0.3rem 0.65rem;border-radius:6px;border:1px solid ${i === 0 ? 'var(--accent)' : 'var(--line)'};background:${i === 0 ? 'var(--accent)' : 'transparent'};color:${i === 0 ? '#fff' : 'var(--muted)'};font-size:0.78rem;cursor:pointer;font-family:inherit;font-weight:${i === 0 ? '600' : '400'}">${g}</button>`).join('\n        ')}
      </div>
      <button id="sb-generate" style="width:100%;padding:0.6rem;border-radius:10px;border:none;background:var(--accent);color:white;font-weight:600;font-size:0.88rem;cursor:pointer;margin-bottom:0.75rem">Generate Name</button>
    </div>
    <div id="sb-output" style="background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:0.75rem;min-height:3rem;color:var(--muted);font-size:0.85rem">Click Generate to create a name</div>
    <div id="sb-error" style="display:none;margin-top:0.35rem;padding:0.5rem;border-radius:6px;background:rgba(239,68,68,0.1);color:#f87171;font-size:0.78rem"></div>

    <script type="module">
      ${config.render}

      var _mod, _loaded = false;
      try {
        _mod = await import('${esmUrl}');
        _loaded = true;
      } catch(e) {
        document.getElementById('sb-error').style.display = 'block';
        document.getElementById('sb-error').textContent = 'Module not deployed yet. Check back soon.';
      }

      var _genre = 'fantasy', _gender = '';
      var output = document.getElementById('sb-output');

      function selectPill(btns, activeVal) {
        btns.forEach(function(b) {
          var isActive = b.dataset.v === activeVal;
          b.style.background = isActive ? 'var(--accent)' : 'transparent';
          b.style.color = isActive ? '#fff' : 'var(--muted)';
          b.style.borderColor = isActive ? 'var(--accent)' : 'var(--line)';
          b.style.fontWeight = isActive ? '600' : '400';
        });
      }

      document.querySelectorAll('.sb-genre').forEach(function(btn) {
        btn.addEventListener('click', function() {
          _genre = this.dataset.v;
          selectPill(document.querySelectorAll('.sb-genre'), _genre);
        });
      });

      document.querySelectorAll('.sb-gender').forEach(function(btn) {
        btn.addEventListener('click', function() {
          _gender = this.dataset.v;
          selectPill(document.querySelectorAll('.sb-gender'), _gender);
        });
      });

      document.getElementById('sb-generate').addEventListener('click', function() {
        if (!_loaded) return;
        try {
          var opts = { genre: _genre };
          if (_gender) opts.gender = _gender;
          var result = _mod.${config.fn}(opts);
          if (result && typeof result.then === 'function') {
            result.then(function(r) { output.innerHTML = renderResult(r); })
              .catch(function(e) { output.innerHTML = '<span style="color:#f87171">Error: ' + e.message + '</span>'; });
          } else {
            output.innerHTML = renderResult(result);
          }
        } catch(e) {
          output.innerHTML = '<span style="color:#f87171">Error: ' + e.message + '</span>';
        }
      });
    <\/script>`;
}

function generateGenericLiveSandbox(agent, esmUrl) {
  const fn = agent.api.functions[0];
  if (!fn) return `<p style="color:var(--muted);font-size:0.85rem">Sandbox coming soon.</p>`;

  return `
    <textarea id="sb-input" rows="3" placeholder="Enter input..." style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:0.85rem;resize:vertical;font-family:inherit;margin-bottom:0.5rem"></textarea>
    <div id="sb-output" style="background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:0.75rem;font-family:monospace;font-size:0.82rem;min-height:3rem;white-space:pre-wrap;word-break:break-all;color:var(--muted)">Type above to try</div>
    <div id="sb-error" style="display:none;margin-top:0.35rem;padding:0.5rem;border-radius:6px;background:rgba(239,68,68,0.1);color:#f87171;font-size:0.78rem"></div>

    <script type="module">
      var _mod, _loaded = false;
      try {
        _mod = await import('${esmUrl}');
        _loaded = true;
      } catch(e) {
        document.getElementById('sb-error').style.display = 'block';
        document.getElementById('sb-error').textContent = 'Module not deployed yet. Check back soon.';
      }

      var _timer;
      var input = document.getElementById('sb-input');
      var output = document.getElementById('sb-output');

      input.addEventListener('input', function() {
        clearTimeout(_timer);
        _timer = setTimeout(function() {
          if (!_loaded) return;
          var v = input.value;
          if (!v.trim()) { output.textContent = 'Type above to try'; return; }
          try {
            var result = _mod.${fn.name}(v);
            if (result && typeof result.then === 'function') {
              result.then(function(r) { output.textContent = JSON.stringify(r, null, 2); })
                .catch(function(e) { output.textContent = 'Error: ' + e.message; });
            } else {
              output.textContent = JSON.stringify(result, null, 2);
            }
          } catch(e) {
            output.textContent = 'Error: ' + e.message;
          }
        }, 200);
      });
    <\/script>`;
}

function generateNoteSandbox(agent) {
  const note = agent.api.note;

  // Canvas/interactive agents: show iframe preview
  if (IFRAME_AGENTS.has(agent.id) && agent.agentUrl) {
    return `
      <p style="color:var(--muted);font-size:0.82rem;margin-bottom:0.75rem">${note}</p>
      <div style="border-radius:8px;overflow:hidden;border:1px solid var(--line);margin-bottom:0.5rem">
        <iframe src="${agent.agentUrl}" style="width:100%;height:400px;border:none" loading="lazy"></iframe>
      </div>
      <a href="${agent.agentUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.78rem;color:var(--muted)">Open full screen &rarr;</a>`;
  }

  // Other note agents: show note + link
  if (agent.agentUrl) {
    return `
      <p style="color:var(--muted);font-size:0.82rem;margin-bottom:0.75rem">${note}</p>
      <a href="${agent.agentUrl}" target="_blank" rel="noopener" class="btn-primary" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.6rem 1.25rem;border-radius:10px;background:var(--accent);color:#fff;font-weight:600;font-size:0.88rem;text-decoration:none">
        Try the full interactive version &rarr;
      </a>`;
  }

  return `<p style="color:var(--muted);font-size:0.82rem">${note}</p>`;
}

function generateMethodSandbox(agent, esmUrl) {
  const methods = agent.sandbox.methods;
  let html = '';

  for (const method of methods) {
    const paramInputs = (method.params ?? []).map((p, i) => {
      if (p.type === 'text' || p.type === 'number') {
        return `<div style="margin-bottom:0.5rem">
          <label style="font-size:0.72rem;color:var(--muted-soft);display:block;margin-bottom:0.2rem">${p.name}</label>
          <input type="${p.type === 'number' ? 'number' : 'text'}" id="param-${method.name}-${i}" value="${p.default ?? ''}" placeholder="${p.placeholder ?? ''}"
            style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-family:monospace;font-size:0.85rem" />
        </div>`;
      }
      if (p.type === 'select') {
        const opts = (p.options ?? []).map(o => `<option value="${o}"${o === p.default ? ' selected' : ''}>${o}</option>`).join('');
        return `<div style="margin-bottom:0.5rem">
          <label style="font-size:0.72rem;color:var(--muted-soft);display:block;margin-bottom:0.2rem">${p.name}</label>
          <select id="param-${method.name}-${i}" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:0.85rem">${opts}</select>
        </div>`;
      }
      if (p.type === 'file') {
        return `<div style="margin-bottom:0.5rem">
          <label style="font-size:0.72rem;color:var(--muted-soft);display:block;margin-bottom:0.2rem">${p.name}</label>
          <input type="file" id="param-${method.name}-${i}" accept="${p.accept ?? '*/*'}"
            style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:0.85rem" />
        </div>`;
      }
      return '';
    }).join('');

    const paramGatherer = (method.params ?? []).map((p, i) => {
      if (p.type === 'number') return `Number(document.getElementById('param-${method.name}-${i}').value)`;
      if (p.type === 'file') return `null /* file handling TODO */`;
      return `document.getElementById('param-${method.name}-${i}').value`;
    }).join(', ');

    if (method.note) {
      html += `<p style="font-size:0.75rem;color:var(--muted-soft);margin-bottom:0.5rem">${method.note}</p>`;
    }

    html += `${paramInputs}
    <button onclick="runSandbox_${method.name}()" style="width:100%;padding:0.6rem;border-radius:10px;border:none;background:var(--accent);color:white;font-weight:600;font-size:0.88rem;cursor:pointer;margin-bottom:0.75rem">${method.label}</button>
    <div id="result-${method.name}" style="background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:0.75rem;font-family:monospace;font-size:0.82rem;min-height:2.5rem;white-space:pre-wrap;word-break:break-all;color:var(--muted)">Click "${method.label}" to try</div>

    ${method.builtInAI ? `<script>
      window.runSandbox_${method.name} = async function() {
        const out = document.getElementById('result-${method.name}');
        out.style.color = 'var(--ink)';
        out.textContent = 'Running...';
        try {
          const g = globalThis;
          const LM = g.LanguageModel || (g.ai && g.ai.languageModel);
          if (!LM || !LM.create) {
            // Fallback: try Ollama
            try {
              const r = await fetch('http://localhost:11434/api/generate', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({model:'llama3.2', prompt: '${(method.systemPrompt ?? '').replace(/'/g, "\\'")}\\n\\n' + ${paramGatherer}, stream:false})
              });
              if (r.ok) { out.textContent = (await r.json()).response; return; }
            } catch(e) {}
            out.style.color = '#fbbf24';
            out.textContent = 'Built-in AI not available in this browser.\\nEnable: chrome://flags → Prompt API for Gemini Nano\\nOr install Ollama locally.';
            return;
          }
          const session = await LM.create({systemPrompt: '${(method.systemPrompt ?? '').replace(/'/g, "\\'")}'});
          const result = await session.prompt(${paramGatherer});
          session.destroy && session.destroy();
          out.textContent = result;
        } catch(e) {
          out.style.color = '#f87171';
          out.textContent = 'Error: ' + e.message;
        }
      };
    <\/script>` : `<script type="module">
      import * as mod from '${esmUrl}';
      window.runSandbox_${method.name} = async function() {
        const out = document.getElementById('result-${method.name}');
        out.style.color = 'var(--ink)';
        out.textContent = 'Running...';
        try {
          const result = mod.${method.name}(${paramGatherer});
          out.textContent = JSON.stringify(result, null, 2);
        } catch(e) {
          out.style.color = '#f87171';
          out.textContent = 'Error: ' + e.message;
        }
      };
    <\/script>`}`;
  }

  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateConfigSandbox(agent) {
  const presets = agent.sandbox.presets ?? [];
  const defaultText = agent.sandbox.defaultText ?? '';

  const presetButtons = presets.map((p, i) =>
    `<button onclick="selectPreset(${i})" id="preset-${i}" style="padding:0.35rem 0.75rem;border-radius:8px;border:1px solid var(--line);background:${i === 0 ? 'var(--accent)' : 'transparent'};color:${i === 0 ? '#fff' : 'var(--muted)'};font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit">${p.name}</button>`
  ).join('\n      ');

  const presetsJson = JSON.stringify(presets).replace(/'/g, "\\'").replace(/<\//g, '<\\/');

  return `
    <div style="margin-bottom:0.5rem">
      <div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-bottom:0.75rem">
        ${presetButtons}
      </div>
      <div id="preset-info" style="font-size:0.72rem;color:var(--muted-soft);margin-bottom:0.5rem">
        ${presets[0]?.fields?.length ? `Extracts: ${presets[0].fields.join(', ')}` : presets[0]?.format ?? ''}
      </div>
    </div>

    <textarea id="sandbox-input" rows="5" style="width:100%;padding:0.6rem;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-family:inherit;font-size:0.82rem;resize:vertical;margin-bottom:0.5rem">${defaultText}</textarea>

    <button onclick="runConfigSandbox()" id="sandbox-run" style="width:100%;padding:0.6rem;border-radius:10px;border:none;background:var(--accent);color:white;font-weight:600;font-size:0.88rem;cursor:pointer;margin-bottom:0.75rem">Summarize</button>

    <div id="sandbox-result" style="background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:0.75rem;font-size:0.82rem;min-height:3rem;white-space:pre-wrap;word-break:break-word;color:var(--muted)">Select a preset and click Summarize</div>

    <div id="sandbox-source" style="font-size:0.68rem;color:var(--muted-soft);margin-top:0.35rem;text-align:right"></div>

    <script>
      var _presets = JSON.parse('${presetsJson}');
      var _activePreset = 0;

      function selectPreset(i) {
        _activePreset = i;
        for (var j = 0; j < _presets.length; j++) {
          var b = document.getElementById('preset-' + j);
          if (b) { b.style.background = j === i ? 'var(--accent)' : 'transparent'; b.style.color = j === i ? '#fff' : 'var(--muted)'; }
        }
        var info = document.getElementById('preset-info');
        var p = _presets[i];
        info.textContent = p.fields && p.fields.length ? 'Extracts: ' + p.fields.join(', ') + ' (' + p.format + ')' : p.format || '';
      }

      async function runConfigSandbox() {
        var input = document.getElementById('sandbox-input').value;
        var out = document.getElementById('sandbox-result');
        var src = document.getElementById('sandbox-source');
        if (!input.trim()) return;
        out.style.color = 'var(--ink)';
        out.textContent = 'Running...';
        src.textContent = '';

        var preset = _presets[_activePreset];
        var prompt = preset.systemPrompt + '\\n';
        if (preset.fields && preset.fields.length) {
          prompt += '\\nExtract these fields:\\n';
          for (var k = 0; k < preset.fields.length; k++) prompt += '- ' + preset.fields[k] + '\\n';
          prompt += '\\nFormat: Use field names as headers.\\n';
        }
        prompt += '\\nText:\\n' + input;

        // Try built-in AI
        try {
          var g = globalThis;
          var LM = g.LanguageModel || (g.ai && g.ai.languageModel);
          if (LM && LM.create) {
            var session = await LM.create({ systemPrompt: preset.systemPrompt });
            out.textContent = await session.prompt(prompt);
            session.destroy && session.destroy();
            src.textContent = 'via Chrome Built-in AI · ' + preset.name + ' config';
            return;
          }
        } catch(e) {}

        // Try Ollama
        try {
          var r = await fetch('http://localhost:11434/api/generate', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ model: 'llama3.2', prompt: prompt, stream: false })
          });
          if (r.ok) {
            out.textContent = (await r.json()).response;
            src.textContent = 'via Ollama · ' + preset.name + ' config';
            return;
          }
        } catch(e) {}

        // Heuristic fallback
        var sentences = input.match(/[^.!?]+[.!?]+/g) || [input];
        var top = sentences.slice(0, Math.min(4, sentences.length));
        out.textContent = top.map(function(s) { return '• ' + s.trim(); }).join('\\n');
        src.textContent = 'via Heuristic fallback (no AI available) · ' + preset.name;
      }
    <\/script>`;
}

function simpleMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let inCode = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        html += '</code></pre>';
        inCode = false;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<pre style="background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:0.75rem;overflow-x:auto;margin:0.5rem 0"><code style="font-size:0.82rem">';
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      html += escapeHtml(line) + '\n';
      continue;
    }

    // Blank line
    if (!line.trim()) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }

    // Headers
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<h3 style="font-size:0.95rem;font-weight:700;margin:1rem 0 0.4rem">' + escapeHtml(line.slice(3)) + '</h3>';
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<h2 style="font-size:1.05rem;font-weight:700;margin:1rem 0 0.4rem">' + escapeHtml(line.slice(2)) + '</h2>';
      continue;
    }

    // List items
    if (/^[-*] /.test(line.trimStart())) {
      if (!inList) { html += '<ul style="margin:0.4rem 0;padding-left:1.25rem">'; inList = true; }
      html += '<li style="font-size:0.88rem;color:var(--muted);margin-bottom:0.2rem">' + inlineMarkdown(line.trimStart().slice(2)) + '</li>';
      continue;
    }

    // Paragraph
    if (inList) { html += '</ul>'; inList = false; }
    html += '<p style="font-size:0.88rem;color:var(--muted);line-height:1.6;margin:0.4rem 0">' + inlineMarkdown(line) + '</p>';
  }

  if (inCode) html += '</code></pre>';
  if (inList) html += '</ul>';
  return html;
}

function inlineMarkdown(text) {
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code style="background:var(--paper);padding:0.1rem 0.3rem;border-radius:3px;font-size:0.82rem">$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

// Generate
for (const agent of registry.agents) {
  const dir = path.join(outDir, 'agents', agent.id);
  fs.mkdirSync(dir, { recursive: true });

  let readmeHtml = '';
  try {
    const readmePath = path.join(__dirname, '..', 'agents', agent.id, 'README.md');
    if (fs.existsSync(readmePath)) {
      const md = fs.readFileSync(readmePath, 'utf-8');
      readmeHtml = simpleMarkdown(md);
    }
  } catch {}

  const html = generateDetailPage(agent, readmeHtml);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`Generated: /agents/${agent.id}/`);
}

// ── Developer pages ──────────────────────────────────────────────────
const devMap = new Map();
for (const agent of registry.agents) {
  const dev = agent.developer ?? 'Unknown';
  if (!devMap.has(dev)) devMap.set(dev, []);
  devMap.get(dev).push(agent);
}

for (const [developer, agents] of devMap) {
  const slug = developer.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dir = path.join(outDir, 'developers', slug);
  fs.mkdirSync(dir, { recursive: true });

  const github = agents[0]?.creatorGithub ?? slug;
  const agentCards = agents.map(a => {
    const isHeuristic = a.type === 'heuristic';
    const tagStyle = isHeuristic
      ? 'background:rgba(217,119,6,0.15);color:#fbbf24'
      : a.type === 'built-in-ai'
      ? 'background:rgba(5,150,105,0.2);color:#34d399'
      : '';
    const tagLabel = isHeuristic ? 'Heuristic' : a.type === 'built-in-ai' ? 'Built-in AI' : a.type === 'model' ? 'Model' : a.type ?? '';
    return `
      <a href="/agents/${a.id}/" style="display:flex;align-items:center;gap:1rem;padding:1rem;border-radius:12px;background:var(--panel);border:1px solid var(--line);text-decoration:none;color:var(--ink);transition:border-color 0.15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--line)'">
        <div style="width:48px;height:48px;border-radius:12px;background:${a.iconBg ?? 'var(--accent)'};display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">${a.icon ?? ''}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:0.95rem">${a.name}</div>
          <div style="font-size:0.82rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.description}</div>
          <div style="display:flex;gap:0.4rem;margin-top:0.3rem">
            ${tagLabel ? `<span style="font-size:0.7rem;padding:0.1rem 0.45rem;border-radius:4px;${tagStyle}">${tagLabel}</span>` : ''}
            <span style="font-size:0.7rem;padding:0.1rem 0.45rem;border-radius:4px;background:var(--line);color:var(--muted)">${a.modelSize ?? '0MB'}</span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </a>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${developer} — FreeBioStore Developer</title>
  <meta name="description" content="${developer} has ${agents.length} agent${agents.length !== 1 ? 's' : ''} on FreeBioStore.">
  <link rel="canonical" href="https://freebiostore.online/developers/${slug}/">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    :root{--font-body:'Manrope',system-ui,sans-serif;--font-display:'Fraunces',Georgia,serif;--paper:#0a0a0a;--panel:#171717;--ink:#fafafa;--muted:#a3a3a3;--muted-soft:#737373;--accent:#7c3aed;--line:#262626;--radius:0.75rem}
    body{font-family:var(--font-body);background:var(--paper);color:var(--ink);-webkit-font-smoothing:antialiased;min-height:100vh}
    .container{max-width:800px;margin:0 auto;padding:0 1.5rem}
    a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
    header{border-bottom:1px solid var(--line)}
    header .container{display:flex;align-items:center;gap:1.25rem;padding-top:0.75rem;padding-bottom:0.75rem}
    .brand{display:flex;align-items:center;gap:0.6rem;text-decoration:none;color:var(--ink)}
    .brand-mark{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#a855f7);display:flex;align-items:center;justify-content:center;font-size:1.1rem}
    .brand-name{font-family:var(--font-display);font-size:1.15rem;font-weight:700}
    nav{display:flex;gap:1.25rem;font-size:0.88rem;font-weight:600;margin-left:auto}
    nav a{color:var(--muted);text-decoration:none}nav a:hover{color:var(--ink)}
    footer{border-top:1px solid var(--line);padding:1.5rem 0;margin-top:2rem;text-align:center;font-size:0.8rem;color:var(--muted-soft)}
    footer a{color:var(--muted)}
  </style>
</head>
<body>
  <header>
    <div class="container">
      <a href="https://freebiostore.online" class="brand">
        <span class="brand-mark">&#x1f916;</span>
        <span class="brand-name">AgentStore</span>
      </a>
      <nav>
        <a href="https://freebiostore.online">Agents</a>
        <a href="https://github.com/FreeBioStore">GitHub</a>
      </nav>
    </div>
  </header>

  <main class="container" style="padding-top:2rem;padding-bottom:2rem">
    <a href="https://freebiostore.online" style="font-size:0.88rem;color:var(--muted);text-decoration:none">&larr; All agents</a>

    <div style="display:flex;align-items:center;gap:1.25rem;margin:1.5rem 0">
      <img src="https://github.com/${github}.png?size=96" alt="${developer}" style="width:72px;height:72px;border-radius:16px;border:2px solid var(--line)" onerror="this.style.display='none'" />
      <div>
        <h1 style="font-family:var(--font-display);font-size:1.5rem;font-weight:700">${developer}</h1>
        <div style="display:flex;gap:0.75rem;margin-top:0.25rem;font-size:0.85rem;color:var(--muted)">
          <span>${agents.length} agent${agents.length !== 1 ? 's' : ''}</span>
          <a href="https://github.com/${github}" style="color:var(--muted)">GitHub &rarr;</a>
        </div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:0.75rem">
      ${agentCards}
    </div>
  </main>

  <footer>
    <div class="container">
      <a href="https://freebiostore.online">FreeBioStore</a> &middot;
      <a href="https://github.com/FreeBioStore">GitHub</a>
    </div>
  </footer>
</body>
</html>`;

  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`Generated developer: /developers/${slug}/ (${agents.length} agents)`);
}

// Update detail pages to link to developer
console.log(`Done. ${registry.agents.length} detail pages + ${devMap.size} developer page(s).`);
