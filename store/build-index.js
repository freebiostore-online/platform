#!/usr/bin/env node
/**
 * Generates agent cards in store/index.html from registry.json.
 * Replaces the contents of <div class="agents-grid" id="agentsGrid">...</div>
 * and updates the agent count, tab bar, and category filter buttons.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'registry.json'), 'utf-8'));
const indexPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

// --- Idempotency: remove previous injections before re-injecting ---
// Remove duplicate Tab bar CSS blocks (keep the first /* Filter bar */ occurrence)
html = html.replace(/\s*\/\* Tab bar \*\/[\s\S]*?\.tab-count \{[^}]+\}\s*\n/g, '\n');
// Remove search input CSS (will be re-injected)
html = html.replace(/\s*\.search-input\{[^}]+\}\s*\n\s*\.search-input:focus\{[^}]+\}\s*\n\s*\.search-input::placeholder\{[^}]+\}\s*\n/g, '\n');
// Remove search input HTML from toolbar (will be re-injected)
html = html.replace(/<input type="text" class="search-input"[^/]*\/>\s*\n\s*/g, '');
// Remove duplicate auth-ui divs (keep zero — we'll inject fresh)
html = html.replace(/<div id="auth-ui"[\s\S]*?<\/div>\s*<\/div>\s*/g, '');
// Remove duplicate auth scripts
html = html.replace(/<script>\s*\(function\(\)\s*\{\s*\/\/ Handle login callback[\s\S]*?<\/script>\s*/g, '');
// Remove API key sections
html = html.replace(/\s*<!-- API_KEYS_SECTION -->[\s\S]*?<\/section>/g, '');
html = html.replace(/\s*<section class="container"[^>]*>[\s\S]*?Bring Your Own API Key[\s\S]*?<\/section>/g, '');

const agents = registry.robots || registry.agents || [];

// --- Compute tab counts ---
const tabCounts = { all: agents.length, firmware: 0, model: 0, behavior: 0 };
agents.forEach(a => {
  if (a.storeType && tabCounts[a.storeType] !== undefined) tabCounts[a.storeType]++;
});

// --- Type label + style mapping ---
function getTypeTag(agent) {
  const style = 'background:rgba(124,58,237,0.15);color:#a78bfa';
  return { label: agent.storeType || 'Interactive', style, secondTag: '' };
}

// Special icon rendering: some icons use HTML entities or monospace font
function renderIcon(agent) {
  const icon = agent.icon;
  // Check if it looks like a short text icon (monospace-style) rather than an emoji
  const isTextIcon = /^[^a-zA-Z]*[a-zA-Z{}#.*<>/]+[^a-zA-Z]*$/.test(icon) && icon.length <= 5;
  const fontStyle = isTextIcon
    ? `;font-family:monospace;font-size:${icon.length > 2 ? '0.75rem' : icon.length > 1 ? '0.9rem' : '1.2rem'}`
    : '';
  return { content: icon, fontStyle };
}

function truncate(str, len) {
  if (!str) return '';
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Generate card HTML for one agent ---
function generateCard(agent) {
  const { label, style, secondTag } = getTypeTag(agent);
  const { content: iconContent, fontStyle } = renderIcon(agent);
  const desc = escapeHtml(truncate(agent.description, 60));

  // For game-ai category with heuristic type (no evolution), show "Game AI" label
  const displayLabel = (agent.category === 'game-ai' && agent.type === 'heuristic' && !agent.evolution)
    ? 'Game AI'
    : label;
  const displayStyle = (agent.category === 'game-ai' && agent.type === 'heuristic' && !agent.evolution)
    ? 'background:rgba(217,119,6,0.15);color:#fbbf24'
    : style;

  // needsKey badge for agent cards
  const needsKeyBadge = agent.needsKey
    ? `\n                <span class="tag" style="background:rgba(234,88,12,0.15);color:#fb923c">API Key</span>`
    : '';

  return `        <div class="agent-card" data-category="${agent.category}" data-store-type="${agent.storeType || 'library'}" data-name="${agent.name.toLowerCase()}" data-desc="${(agent.description || '').toLowerCase()}">
          <a href="/items/${agent.id}/" class="agent-card-body">
            <div class="agent-icon" style="background:${agent.iconBg}${fontStyle}">${iconContent}</div>
            <div class="agent-body">
              <span class="agent-name">${escapeHtml(agent.name)}</span>
              <span class="agent-desc">${desc}</span>
              <div class="agent-meta">
                <span class="tag" style="${displayStyle}">${displayLabel}</span>
                <span class="tag">${escapeHtml(secondTag)}</span>${needsKeyBadge}
              </div>
            </div>
          </a>
          <a href="/items/${agent.id}/" class="agent-cta">
            <svg viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20"/></svg>
            Open
          </a>
        </div>`;
}

// --- Build all cards ---
const cardsHtml = agents.map(generateCard).join('\n\n');

// --- Replace agents-grid content ---
const gridOpenTag = '<div class="agents-grid" id="agentsGrid">';
const gridStart = html.indexOf(gridOpenTag);
if (gridStart === -1) {
  console.error('ERROR: Could not find agents-grid div in index.html');
  process.exit(1);
}
const contentStart = gridStart + gridOpenTag.length;

// Find the matching closing </div> — count nesting
let depth = 1;
let pos = contentStart;
while (depth > 0 && pos < html.length) {
  const nextOpen = html.indexOf('<div', pos);
  const nextClose = html.indexOf('</div>', pos);
  if (nextClose === -1) break;
  if (nextOpen !== -1 && nextOpen < nextClose) {
    depth++;
    pos = nextOpen + 4;
  } else {
    depth--;
    if (depth === 0) {
      // nextClose is our closing tag
      html = html.slice(0, contentStart) + '\n' + cardsHtml + '\n      ' + html.slice(nextClose);
    } else {
      pos = nextClose + 6;
    }
  }
}

// --- Update agent count ---
html = html.replace(
  /<span class="agent-count"[^>]*>[^<]*<\/span>/,
  `<span class="agent-count" id="agentCount">${agents.length} agents</span>`
);

// --- Update tab bar ---
const tabBarHtml = `<div class="tabs"><button class="tab active" onclick="switchTab('all')">All <span class="tab-count">${tabCounts.all}</span></button></div>`;

// Replace existing tabs div or insert before toolbar
const existingTabsMatch = html.match(/<div class="tabs"><button class="tab active" onclick="switchTab('all')">All <span class="tab-count">${tabCounts.all}</span></button></div>
      <a href="/v1/keys" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1.25rem;border-radius:10px;background:var(--accent);color:white;font-weight:600;font-size:0.88rem;text-decoration:none">Manage API Keys</a>
      <p style="color:var(--muted-soft);font-size:0.72rem;margin-top:0.5rem">Encrypted with AES-256-GCM. Keys never leave the platform server.</p>
    </div>
  </section>`;

// Insert API Keys section once — replace the marker if it exists, or insert before "Where everything lives"
const API_KEY_MARKER = '<!-- API_KEYS_SECTION -->';

// Remove any existing API keys sections (prevents duplication on re-runs)
html = html.replace(/\s*<section class="container"[^>]*>[\s\S]*?Bring Your Own API Key[\s\S]*?<\/section>/g, '');
html = html.replace(new RegExp(API_KEY_MARKER, 'g'), '');

// Insert once before "Where everything lives"
const whereEverything = '<!-- Where everything lives -->';
const wherePos = html.indexOf(whereEverything);
if (wherePos !== -1) {
  html = html.slice(0, wherePos) + API_KEY_MARKER + '\n' + apiKeysSection + '\n\n  ' + html.slice(wherePos);
}

// --- Update JavaScript ---
const oldScript = `<script>
    var _catFilter = 'all';
    var _typeFilter = '';

    function filterAgents(cat) {
      _catFilter = cat;
      // Update category button active states (first toolbar only)
      var toolbars = document.querySelectorAll('.toolbar');
      toolbars[0].querySelectorAll('.filter-btn').forEach(function(b) {
        b.classList.toggle('active', b.textContent.toLowerCase() === cat || (cat === 'all' && b.textContent === 'All'));
      });
      applyFilters();
    }

    function filterType(type) {
      _typeFilter = type;
      // Update type button active states (second toolbar)
      var toolbars = document.querySelectorAll('.toolbar');
      if (toolbars[1]) {
        toolbars[1].querySelectorAll('.filter-btn').forEach(function(b) {
          b.classList.toggle('active', b.textContent.toLowerCase().replace(/\\s+/g, '-') === type || b.textContent.toLowerCase() === type);
        });
      }
      applyFilters();
    }

    function applyFilters() {
      var cards = document.querySelectorAll('.agent-card');
      var visible = 0;
      cards.forEach(function(c) {
        var catMatch = _catFilter === 'all' || c.dataset.category === _catFilter;
        var typeMatch = true;
        if (_typeFilter) {
          // Read type from the first .tag in .agent-meta
          var tag = c.querySelector('.agent-meta .tag');
          var tagText = tag ? tag.textContent.toLowerCase().replace(/\\s+/g, '-') : '';
          typeMatch = tagText.indexOf(_typeFilter) >= 0;
        }
        var show = catMatch && typeMatch;
        c.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      document.getElementById('agentCount').textContent = visible + ' agent' + (visible !== 1 ? 's' : '');
    }
  </script>`;

const newScript = `<script>
    var _tab = 'all';
    var _category = 'all';
    var _search = '';

    function switchTab(tab) {
      _tab = tab;
      document.querySelectorAll('.tab').forEach(function(t) {
        var label = t.textContent.trim().split(' ')[0].toLowerCase();
        t.classList.toggle('active', label === tab || (tab === 'all' && label === 'all'));
      });
      applyFilters();
    }

    function filterCategory(cat) {
      _category = cat;
      document.querySelectorAll('.toolbar .filter-btn').forEach(function(b) {
        b.classList.toggle('active', b.textContent.toLowerCase() === cat || (cat === 'all' && b.textContent === 'All'));
      });
      applyFilters();
    }

    function applyFilters() {
      var cards = document.querySelectorAll('.agent-card');
      var visible = 0;
      cards.forEach(function(c) {
        var tabMatch = _tab === 'all' || c.dataset.storeType === _tab;
        var catMatch = _category === 'all' || c.dataset.category === _category;
        var searchMatch = !_search || (c.dataset.name && c.dataset.name.includes(_search)) || (c.dataset.desc && c.dataset.desc.includes(_search));
        var show = tabMatch && catMatch && searchMatch;
        c.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      document.getElementById('agentCount').textContent = visible + ' agent' + (visible !== 1 ? 's' : '');
    }

    document.getElementById('searchInput').addEventListener('input', function(e) {
      _search = e.target.value.toLowerCase().trim();
      applyFilters();
    });
  </script>`;

html = html.replace(oldScript, newScript);

// --- Auth UI injection ---
// Add auth-ui div after </nav> inside header
const navCloseTag = '</nav>';
const navClosePos = html.indexOf(navCloseTag);
if (navClosePos !== -1) {
  const authUiHtml = `</nav>
      <div id="auth-ui" style="margin-left:0.5rem;display:flex;align-items:center">
        <a href="/v1/auth/github" id="auth-login" style="display:none;padding:0.35rem 0.85rem;border-radius:8px;border:1px solid var(--line);color:var(--muted);font-size:0.82rem;font-weight:600;text-decoration:none;transition:border-color 0.15s,color 0.15s" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--ink)'" onmouseout="this.style.borderColor='var(--line)';this.style.color='var(--muted)'">Sign in</a>
        <div id="auth-user" style="display:none;align-items:center;gap:0.5rem">
          <img id="auth-avatar" src="" alt="" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--line)" />
          <button id="auth-signout" style="padding:0.25rem 0.6rem;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:0.72rem;cursor:pointer;font-family:inherit">Sign out</button>
        </div>
      </div>`;
  html = html.slice(0, navClosePos) + authUiHtml + html.slice(navClosePos + navCloseTag.length);
}

// Add auth script before closing </body>
const authScript = `
  <script>
    (function() {
      // Handle login callback: /?login=success#session=<token>
      if (location.search.includes('login=success') && location.hash.startsWith('#session=')) {
        var token = location.hash.slice('#session='.length);
        if (token) {
          localStorage.setItem('fags_session', JSON.stringify({ token: token }));
          // Clean URL
          history.replaceState(null, '', '/');
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
        // Decode payload to get avatar + login
        try {
          var parts = session.token.split('.');
          var payload = JSON.parse(atob(parts[0]));
          if (payload.exp && payload.exp < Date.now() / 1000) {
            // Expired — clear and show login
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

      if (!session) {
        loginEl.style.display = 'inline-block';
      }

      signoutEl.addEventListener('click', function() {
        fetch('/v1/auth/logout', { method: 'POST' }).finally(function() {
          localStorage.removeItem('fags_session');
          location.reload();
        });
      });
    })();
  </script>`;

const bodyClosePos = html.lastIndexOf('</body>');
if (bodyClosePos !== -1) {
  html = html.slice(0, bodyClosePos) + authScript + '\n' + html.slice(bodyClosePos);
}

// --- Clean up and write back ---
// Clean up whitespace (prevents accumulation on re-runs)
html = html.replace(/\n{3,}/g, '\n\n');
html = html.replace(/\n\s+\n/g, '\n\n');
html = html.trimEnd() + '\n';
fs.writeFileSync(indexPath, html, 'utf-8');
console.log(`Updated index.html with ${agents.length} agent cards, tabs (${tabCounts.library} libraries, ${tabCounts.model} models, ${tabCounts.agent} agents), ${categories.length} category filters, and API Keys section.`);
