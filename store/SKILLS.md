# FreeBioStore — AI Agent Guide

Point your Claude Code, Codex, or any AI agent to this file for platform-aware development.

**Add to your CLAUDE.md or agent config:**
```
See https://freebiostore.online/skills.md for platform skills.
```

---

## Platform Overview

FreeBioStore hosts browser-based AI tools in 3 types:
- **Libraries** — pure TypeScript, npm-publishable, ESM at `/pkg/{id}/index.js`
- **Models** — ONNX via Transformers.js, runs on user's GPU (WebGPU/WASM)
- **Agents** — use user's API key via platform proxy, or Chrome Built-in AI

All agents are MIT-licensed, open source, one repo per agent in the `FreeBioStore` GitHub org.

## Tech Stack

- **Runtime**: Browser (no server for libraries/models), Cloudflare Workers (proxy/key vault)
- **Framework**: React 19 + Vite 6 + Tailwind CSS 4 (for webapp agents)
- **Build**: tsup (for library agents → ESM)
- **Package manager**: pnpm (monorepo), npm (individual agent repos)
- **Hosting**: Cloudflare R2 + host Worker (path-based routing)
- **Database**: Cloudflare D1 (routes, users, API keys, usage)
- **Encryption**: AES-256-GCM (user API keys)

## Creating an Agent

### 1. Scaffold

```bash
npx @freebiostore/cli init my-agent --template heuristic
# Templates: heuristic | built-in-ai | model
```

### 2. Implement

**Library agent** (heuristic):
```
my-agent/
├── src/index.ts     — public API exports
├── src/logic.ts     — core heuristic (pure TS, no DOM)
├── agent.json       — manifest
├── package.json     — @freebiostore/my-agent
└── tsconfig.json
```

**Webapp agent** (model or built-in-ai):
```
my-agent/
├── web/
│   ├── src/App.tsx  — React UI
│   ├── src/core.ts  — inference logic
│   └── ...          — Vite + Tailwind boilerplate
├── agent.json
└── package.json
```

### 3. Core logic rules

- **Pure TypeScript** — no React/DOM imports in core logic files
- **Exportable** — core functions work as both library and webapp
- **Deterministic** — heuristic agents produce same output for same input
- **No cloud API calls** — models run in browser, not on a server
- **Under 1MB bundle** (excluding models)

### 4. Publish

```bash
npx @freebiostore/cli check    # compliance scan
npx @freebiostore/cli publish  # creates repo, deploys, registers route
```

## Agent Manifest (agent.json)

```json
{
  "name": "My Agent",
  "description": "What it does in one sentence.",
  "version": "1.0.0",
  "task": "task-name",
  "category": "text|productivity|code|vision|game-ai|creative|audio|education|automation",
  "models": [],
  "estimatedDownload": "0MB",
  "input": ["text/plain"],
  "output": ["application/json"],
  "requiresWebGPU": false,
  "offlineCapable": true,
  "desktopOnly": false,
  "runtimeType": "heuristic|built-in-ai|model"
}
```

## Design System

- **Theme**: Dark only (neutral-950/900/800)
- **Fonts**: Fraunces (headings), Manrope (body)
- **Accent**: Purple `#7c3aed`
- **Header**: FreeBioStore link + agent name + type badge
- **Footer**: "Heuristic/Model/AI agent — runs in your browser"

See BRAND.md for full guidelines.

## Evolved Heuristics

Heuristic agents track their evolution:
```json
{ "evolution": { "versions": 7, "examples": 500, "accuracy": 94 } }
```

The code was written by an LLM from training data, not hand-coded. To evolve:
1. Collect examples where the heuristic fails
2. Feed failures + current code to LLM
3. LLM writes improved version
4. Eval against full test set
5. If accuracy improves → ship new version

## API Key System

Users store API keys once on the platform:
- **Key vault**: `/v1/keys` — encrypted AES-256-GCM in D1
- **Proxy**: `/v1/proxy/{host}/{path}` — injects key server-side
- **Providers**: OpenAI, Anthropic, Google AI, Groq, OpenRouter, Together AI

Agents call the proxy with a session token:
```typescript
fetch('https://freebiostore.online/v1/proxy/api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-4o-mini', messages: [...] }),
});
```

## MCP Server

Connect to the platform from any MCP client:
```bash
npx mcp-remote https://mcp.freebiostore.online/mcp
```

Tools: list_agents, agent_info, deploy_status, create_agent, delete_agent, write_file, read_file, list_files, upload_to_r2, platform_guide, sdk_reference.

## Deploy

Push to `main` → GitHub Actions → R2. Each agent repo has its own `deploy.yml`:
- **Library agents**: tsup build → ESM uploaded to `/pkg/{id}/`
- **Webapp agents**: Vite build → dist uploaded to `/agents/{id}/`

## Compliance

9 checks enforced:
1. MIT license required
2. `agent.json` manifest with required fields
3. Bundle < 1MB (excluding models)
4. No cloud AI API calls (models run in browser)
5. No tracking scripts
6. AI inference in Web Workers (not main thread)
7. Models cached in Cache Storage
8. No data exfiltration
9. Dark mode support
