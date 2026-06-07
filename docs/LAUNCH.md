# Launch Checklist

## Before you post

### npm token (required, 5 min)
1. Go to https://www.npmjs.com/settings/serge-ivo/tokens
2. Generate → Automation token (no 2FA prompt on CI)
3. Set in Doppler: `doppler secrets set NPM_TOKEN=npm_xxxxx --project fags --config prd`
4. Doppler auto-syncs to GitHub org secrets → CI will publish on next push

### Manual OAuth test (required, 2 min)
1. Open https://freebiostore.online
2. Click "Sign in" → GitHub OAuth → authorize
3. Verify avatar shows in header, console works at /console/
4. Store a test API key at /console/#keys
5. Open an agent at /a/chatbot/, verify proxy works with your key

---

## Launch copy

### Product Hunt

**Tagline:** AI tools that run free in your browser

**Description:**
FreeBioStore is a curated collection of 53 browser-based AI tools — sentiment analysis, text-to-speech, language detection, background removal, and more. Every tool runs entirely on your device using WebGPU, WASM, or Chrome's built-in AI. No sign-up required, no data leaves your browser.

Three types of tools:
- **Libraries** (29) — Pure TypeScript functions, npm-installable
- **Models** (14) — ONNX models via Transformers.js, runs on your GPU
- **Agents** (10) — Chat with AI using your own API key (encrypted, server-side injection)

Built for developers: every tool is MIT-licensed, has an ESM package at /pkg/{id}/, and can be imported in one line. SDK, CLI, and MCP server included.

**First comment:**
Hi HN/PH! I built this because I was tired of AI tools that require accounts, collect data, and charge subscriptions for things that can run locally. Every tool here downloads once and runs on your hardware — WebGPU for models, pure JS for heuristics. The "evolved heuristic" agents are interesting: I used an LLM to write classifier code from labeled examples (the FunSearch pattern), then ship the generated code as pure JS — no model needed at runtime. AMA!

### Hacker News (Show HN)

**Title:** Show HN: FreeBioStore – 53 AI tools that run in your browser (WebGPU/WASM)

**Text:**
I built a curated store of browser-based AI tools. Everything runs on your device — no server, no account, no data collection.

The interesting part: 29 of the tools are "evolved heuristics" — I used an LLM to write JavaScript classifier code from labeled examples, then ship the generated code as pure JS. No model download, instant results. Think FunSearch but for practical text classifiers.

The other tools use Transformers.js (ONNX models on WebGPU/WASM) or Chrome's built-in Gemini Nano model.

Stack: Cloudflare Workers + R2 + D1 + Durable Objects. Each tool is a separate GitHub repo with its own deploy pipeline. Platform handles auth (GitHub OAuth), API key vault (AES-256-GCM), proxy, and real-time mobile mirroring (WebSocket via DO).

https://freebiostore.online

Source: https://github.com/FreeBioStore/platform

### dev.to

**Title:** I built 53 AI tools that run entirely in your browser — here's how

**Tags:** ai, webdev, javascript, opensource
