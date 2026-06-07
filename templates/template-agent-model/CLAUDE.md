# AGENTNAME

`runtimeType: model`

## Build

```bash
npm install
npm run build     # dist/index.js + dist/index.d.ts
npm run typecheck
```

## Deploy

Push to main → GitHub Actions → builds ESM → uploads to R2 at /pkg/AGENTNAME/
