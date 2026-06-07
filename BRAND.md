# FreeBioStore Brand Guidelines

## Mission

FreeBioStore is an open platform for browser-based AI tools — libraries, models, and agents that run on the user's hardware. Free forever, fully private, open source. No cloud inference cost, no subscription, no tracking.

## Platform Rules

1. **Free means free.** No freemium, no ads, no paywalls. Libraries and models are always free. Agents that use API keys cost the user whatever their provider charges — the platform charges nothing.
2. **Browser-first.** Everything runs in the browser. Models via WebGPU/WASM, heuristics via pure JS, AI calls via user's own API key through the platform proxy.
3. **Private by default.** No tracking, no analytics, no data leaves the device. API keys are encrypted (AES-256-GCM) and never exposed to the browser.
4. **Open source.** Every agent is MIT-licensed with its own GitHub repo.
5. **Evolved heuristics.** Classifiers are written by LLMs from data, not hand-coded. They improve from user feedback across versions.

## Logo

### Wordmark

- **FreeBioStore** — written as one word with "Agent" highlighted in accent purple
- Font: Fraunces (display), weight 700
- Usage: `Free[Agent]Store` with "Agent" in `#a78bfa` (accent-light)

### Icon

- Purple gradient rounded rectangle with white "A"
- Gradient: `#7c3aed` → `#6d28d9` (135deg)
- Border radius: 96px on 512px canvas (18.75%)
- Letter: Manrope, weight 800, size 300 on 512 canvas

### Files

```
store/
├── favicon.svg          — vector icon (primary, used by browsers)
├── icon-192.png         — 192×192 PNG (PWA manifest, Android)
├── icon-512.png         — 512×512 PNG (PWA manifest, social, GitHub)
├── apple-touch-icon.png — 180×180 PNG (iOS home screen)
└── manifest.json        — PWA manifest
```

Regenerate PNGs from SVG:
```bash
rsvg-convert -w 512 -h 512 store/favicon.svg > store/icon-512.png
rsvg-convert -w 192 -h 192 store/favicon.svg > store/icon-192.png
rsvg-convert -w 180 -h 180 store/favicon.svg > store/apple-touch-icon.png
```

## Colors

| Name | Hex | Usage |
|---|---|---|
| **Accent** | `#7c3aed` | Buttons, links, active states, icon gradient start |
| **Accent hover** | `#6d28d9` | Button hover, icon gradient end |
| **Accent light** | `#a78bfa` | Highlighted text ("Agent" in wordmark), code |
| **Accent soft** | `rgba(124,58,237,0.15)` | Tag backgrounds, soft highlights |
| **Paper** | `#0a0a0a` | Page background |
| **Panel** | `#171717` | Cards, modals, elevated surfaces |
| **Ink** | `#fafafa` | Primary text |
| **Muted** | `#a3a3a3` | Secondary text |
| **Muted soft** | `#737373` | Tertiary text, labels |
| **Line** | `#262626` | Borders, dividers |

### Store type badge colors

| Type | Background | Text |
|---|---|---|
| Heuristic | `rgba(217,119,6,0.15)` | `#fbbf24` (yellow) |
| Evolved | `rgba(217,119,6,0.15)` | `#fbbf24` (yellow) |
| Model | `rgba(59,130,246,0.15)` | `#60a5fa` (blue) |
| Built-in AI | `rgba(5,150,105,0.2)` | `#34d399` (green) |
| Game AI | `rgba(217,119,6,0.15)` | `#fbbf24` (yellow) |

## Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Display / headings | Fraunces (serif) | 700 | 1.15rem–2.5rem |
| Body / UI | Manrope (sans-serif) | 400–700 | 0.82rem–1.1rem |
| Code | System monospace | 400 | 0.82rem–0.88rem |

Fallback stacks:
- Sans: `'Manrope', system-ui, sans-serif`
- Serif: `'Fraunces', Georgia, serif`

Google Fonts import:
```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
```

## Theme

Always dark. No light mode. All pages use:
```css
:root {
  --font-body: 'Manrope', system-ui, sans-serif;
  --font-display: 'Fraunces', Georgia, serif;
  --paper: #0a0a0a;
  --panel: #171717;
  --ink: #fafafa;
  --muted: #a3a3a3;
  --muted-soft: #737373;
  --accent: #7c3aed;
  --accent-hover: #6d28d9;
  --accent-soft: rgba(124,58,237,0.15);
  --line: #262626;
  --radius: 0.75rem;
}
```

## Page Layout

### Header (all pages)
```
[🤖 AgentStore] [Agents] [About] [Get Started] [Console] [GitHub] [Pro]  [Sign in / Avatar]
```
- Brand mark: 36×36 purple gradient square with bot emoji
- Nav links: Manrope 600, muted color, hover → ink
- "Pro" link: blue (#3b82f6)
- Auth UI: "Sign in" link or user avatar + "Sign out"

### Footer (all pages)
```
FreeBioStore · Docs · GitHub · Pro
FreeStore Family: FreeAppStore | FreeGameStore | FreeWebStore | FreeBioStore
```

## FreeStore Family

| Store | Color | Letter | Domain |
|---|---|---|---|
| FreeAppStore | Blue `#2563eb` | A | freeappstore.online |
| FreeGameStore | Green `#10b981` | G | freegamestore.online |
| FreeWebStore | Amber `#f59e0b` | W | freewebstore.online |
| **FreeBioStore** | **Purple `#7c3aed`** | **A** | **freebiostore.online** |
| ProAgentStore | Purple `#7c3aed` | A | proagentstore.online |

All stores share: Manrope + Fraunces fonts, dark theme, rounded cards, same footer pattern. Only accent color and brand mark differ.

## Agent Card Design

```
┌─────────────────────────────────────────┐
│ [Icon 48px]  Agent Name                 │
│              Description truncated...   │
│              [Type badge] [Size badge]  │
│                              [▶ Open]   │
└─────────────────────────────────────────┘
```

- Icon: 48×48 rounded square with `iconBg` color + emoji
- Name: Manrope 600
- Description: muted, truncated to ~60 chars
- Badges: pill-shaped, type-colored (see badge colors above)
- CTA: purple play button

## Do / Don't

**Do:**
- Use the SVG favicon as the primary icon (all modern browsers support it)
- Keep the dark theme consistent across all pages
- Use Fraunces for headings, Manrope for body
- Show agent type (Library/Model/Agent) clearly on every card
- Link "View Source" to the agent's individual GitHub repo

**Don't:**
- Add a light mode (dark only, matches all other stores)
- Use colors outside the palette
- Create agent-specific branding (all agents use the platform brand)
- Use custom fonts beyond Fraunces + Manrope
