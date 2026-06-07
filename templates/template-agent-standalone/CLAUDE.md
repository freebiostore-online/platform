# AGENTNAME

A browser-based AI agent on [FreeBioStore](https://freebiostore.online).

## SDK

```ts
import { initAgent } from '@freebiostore/sdk'
const agent = initAgent({ agentId: 'AGENTNAME' })
```

## Development

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # web/dist/
```

## Deploy

Push to main → GitHub Actions → R2 → live at https://freebiostore.online/a/AGENTNAME/

## Structure

```
AGENTNAME/
├── agent.json          # Agent manifest
├── web/
│   ├── src/
│   │   ├── App.tsx     # Main UI
│   │   ├── main.tsx    # Entry point
│   │   ├── index.css   # Tailwind + design tokens
│   │   └── *.ts        # Core logic (no React deps — importable as library)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── LICENSE             # MIT required
└── package.json        # Root workspace
```

## Compliance

- MIT license required
- No cloud AI API calls (models run in browser)
- Bundle < 1MB (excluding models)
- No tracking scripts
- Core logic must be pure TypeScript (no React/DOM deps) for library use
