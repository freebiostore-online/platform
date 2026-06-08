# FreeBioStore

**[freebiostore.pages.dev](https://freebiostore.pages.dev)** — Free interactive biology & biotech simulations. No signup, no install, runs in your browser.

## What is this?

FreeBioStore is part of [Open Frontier](https://freeprostores.pages.dev) — a collection of free educational simulation stores covering robotics, quantum computing, biology, chip design, space, and blockchain.

Every simulation is:
- **Interactive** — change inputs, see results in real-time
- **Self-contained** — one HTML file, no dependencies
- **Free forever** — no signup, no paywall, open source
- **Educational** — teaches *how* things work, not just *what* they are

## Contributing

**We want your simulations!** The barrier is intentionally low:

1. Write a single self-contained HTML file
2. Add a registry entry (one JSON object)
3. Open a PR

See [CONTRIBUTING.md](./CONTRIBUTING.md) for design rules and examples.

## Community

- **Discord:** [discord.gg/openfrontier](https://discord.gg/openfrontier) (#biotech channel)
- **Issues:** [GitHub Issues](https://github.com/freebiostore-online/platform/issues) for bugs & ideas
- **Showcase:** Share what you built in #showcase on Discord

## Local development

```bash
# Just open any simulation directly in your browser
open store/items/*/index.html

# Or serve locally
npx serve store
```

No build step. No node_modules. No framework. Just HTML.

## License

MIT — do whatever you want with these simulations.
