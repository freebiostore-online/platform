# AGENTNAME — Pipeline Agent

A **pipeline** heuristic agent on [FreeBioStore](https://freebiostore.online).

Pipelines chain multiple heuristic steps to replace multi-step LLM automation.
Instead of sending HTML to an LLM at each step, each stage runs a trained
heuristic — zero tokens, sub-millisecond per step.

## How pipelines work

```
HTML input
  -> Step 1: Classify (is this the right page?)
  -> Step 2: Extract (find the relevant elements)
  -> Step 3: Decide (what action to take)
  -> Output: structured action plan
```

Each step is a standalone heuristic function. The pipeline orchestrates them
and short-circuits on failure (wrong page type? stop immediately).

## Output shape

```ts
{
  steps: Array<{
    name: string;
    status: 'pass' | 'fail' | 'skip';
    result: unknown;
    timeMs: number;
  }>;
  action: {               // what the automation agent should do next
    type: string;         // 'fill', 'click', 'navigate', 'wait', 'done', 'error'
    target?: string;      // CSS selector
    value?: string;       // value to fill
    confidence: number;
  } | null;
}
```

## Use cases

- **ATS login**: classify page -> find email/password fields -> produce fill instructions
- **Job application**: detect listing -> extract "Apply" button -> click instruction
- **Form submission**: detect form type -> find fields -> map data -> fill plan
- **Navigation**: detect current page -> find target link -> navigate instruction
- **Error recovery**: detect error state -> classify error type -> recovery action

A typical ATS login flow burns ~5000 tokens. A trained pipeline: zero tokens.

## Training each step

Each step's heuristic can be trained independently via the
[Trainer](https://freebiostore.online/a/trainer/). Train the classifier
first, then the extractor, then wire them together in the pipeline.

## Development

```bash
pnpm install && pnpm dev   # http://localhost:5173
pnpm test                   # run pipeline tests
```

Push to main = auto-deploy to https://freebiostore.online/a/AGENTNAME/
