# Chatbot Agent — FAGS

A document-chat agent that runs entirely in the browser. Users upload docs, chat with them using their own API key (via the platform key vault + proxy). No server needed.

## Why FAGS, not PAGS

This agent needs:
- Document storage → IndexedDB (browser-local, free)
- AI inference → user's API key via `/v1/proxy/` (no server cost)
- Chat UI → single-page app

It does NOT need:
- Cron/scheduling
- Multi-user shared state
- Server-side models
- Webhook ingestion
- Background processing

PAGS agents require server power. This one doesn't.

## Architecture

```
User uploads docs → stored in IndexedDB (browser)
User chats → docs injected into prompt context
Prompt sent via /v1/proxy/api.openai.com/... → user's key injected server-side
Response streamed back to browser
```

### Storage

- **IndexedDB** for documents (title, content, source, addedAt)
- **localStorage** for chat history + agent config
- No server storage — everything stays on user's device

### Inference

Uses the FAGS key vault + proxy:
1. User stores their OpenAI/Anthropic/Google key once at `freebiostore.online/console/` → Profile → API Keys
2. Agent calls `/v1/proxy/api.openai.com/v1/chat/completions` with the chat payload
3. Proxy decrypts user's key, injects it, forwards to OpenAI
4. Response comes back — user pays their own OpenAI bill

Fallback chain:
1. User's stored key via proxy (best quality)
2. Chrome Built-in AI / Gemini Nano (free, lower quality, Chrome-only)
3. Ollama local (if running on localhost:11434)

### Knowledge Base

Documents are chunked and injected into the system prompt:
- Each doc stored as `{ id, title, content, source }` in IndexedDB
- On chat, all docs concatenated into system prompt (30KB cap)
- No vector embeddings (keep it simple for v1)
- Sources: paste text, import URL (fetch + strip HTML), upload file (.txt, .md, .csv)

Future: chunking + embeddings via `@freebiostore/smart-search` agent for better retrieval.

## Agent Config

```json
{
  "id": "chatbot",
  "name": "Document Chatbot",
  "description": "Chat with your documents. Upload files, paste text, or import URLs. Answers using your own AI key.",
  "task": "document-chat",
  "category": "productivity",
  "type": "agent",
  "icon": "💬",
  "iconBg": "#7c3aed",
  "backends": ["proxy", "built-in-ai", "ollama"],
  "requiresWebGPU": false,
  "desktopOnly": false,
  "offlineCapable": false
}
```

## UI

Single page app with:

### 1. Setup panel (first use)
- Check if user has an API key stored → if not, link to Profile → API Keys
- Choose provider: OpenAI (default) / Anthropic / Google / Ollama

### 2. Knowledge panel (left sidebar)
- List of documents with title, size, source badge
- "Add" button → paste text, import URL, upload file
- Delete button per doc
- Total size indicator (warn at 30KB context limit)

### 3. Chat panel (main area)
- Message history (user + assistant bubbles)
- Input bar with send button
- "Thinking..." indicator during inference
- System messages for errors

### 4. Config (gear icon)
- Agent name (customizable)
- System prompt override
- Model selector (gpt-4o-mini, gpt-4o, claude-3-haiku, gemini-flash)
- Temperature slider
- Response style (concise/detailed/professional/casual)
- Topic restrictions (optional guardrails)

## File Structure

```
agents/chatbot/
├── web/
│   ├── index.html      — single-page app
│   ├── src/
│   │   ├── App.tsx
│   │   ├── store.ts     — IndexedDB wrapper for docs + chat history
│   │   ├── inference.ts  — proxy + built-in AI + ollama fallback
│   │   ├── knowledge.ts  — doc management, URL ingestion, chunking
│   │   └── config.ts     — agent config, provider selection
│   └── vite.config.ts
├── agent.json
├── README.md
└── .github/workflows/deploy.yml
```

## Implementation Notes

### Proxy call pattern
```typescript
const response = await fetch('https://freebiostore.online/v1/proxy/api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${fasSessionToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt + '\n\n' + docsContext },
      ...chatHistory,
      { role: 'user', content: userMessage },
    ],
    stream: true,
  }),
});
```

### Built-in AI fallback
```typescript
if ('ai' in window && 'languageModel' in window.ai) {
  const session = await window.ai.languageModel.create({
    systemPrompt: systemPrompt + '\n\n' + docsContext,
  });
  const response = await session.prompt(userMessage);
}
```

### IndexedDB schema
```typescript
const db = await openDB('chatbot', 1, {
  upgrade(db) {
    db.createObjectStore('documents', { keyPath: 'id' });
    db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
    db.createObjectStore('config', { keyPath: 'key' });
  },
});
```

## Build & Deploy

```bash
cd agents/chatbot
pnpm install
pnpm dev          # local dev at localhost:5173
pnpm build        # builds to web/dist/
fags publish      # deploys to freebiostore.online/a/chatbot/
```

## Limits (free tier)

- Document storage: IndexedDB (browser limit, typically 50MB+)
- Context window: 30KB of docs injected per chat turn
- Inference: depends on user's API key quota
- Chat history: last 50 messages in context
- No server cost to the platform — user pays their own AI provider
