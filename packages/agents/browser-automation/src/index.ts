/**
 * Browser Automation Agent — record, condense, replay.
 *
 * Three phases:
 * 1. RECORD: capture DOM events (clicks, fills, navigates) via event listeners
 * 2. CONDENSE: Chrome Built-in AI compresses recording into clean JS
 * 3. REPLAY: execute the condensed code on same-origin pages
 *
 * The output is DETERMINISTIC JS — no LLM at runtime.
 * The LLM is only used during the "condense" phase (training time).
 *
 * Example flow:
 *   Record: user fills a form on an internal tool
 *   Condense: LLM writes → function fillForm(data) { ... }
 *   Replay: agent runs fillForm() with new data — no LLM needed
 */

export interface RecordedAction {
  type: 'click' | 'fill' | 'select' | 'navigate' | 'wait' | 'scroll';
  timestamp: number;
  target: {
    selector: string;
    tag: string;
    text?: string;
    attributes?: Record<string, string>;
  };
  value?: string;
  url?: string;
}

export interface AutomationScript {
  name: string;
  description: string;
  /** The condensed JS code — deterministic, no LLM at runtime. */
  code: string;
  /** Parameters the script accepts. */
  params: { name: string; type: string; description: string }[];
  /** Original recorded actions (for debugging/retraining). */
  recording: RecordedAction[];
  /** How many times the script was condensed/improved. */
  version: number;
  /** URL pattern this script works on. */
  urlPattern: string;
}

/**
 * Generate a CSS selector for a DOM element.
 * Tries: id → data attributes → unique class → nth-child path.
 */
export function selectorFor(el: Element): string {
  if (el.id) return `#${el.id}`;

  // data-testid or data-cy (common in tested apps)
  for (const attr of ['data-testid', 'data-cy', 'data-test', 'data-id']) {
    const val = el.getAttribute(attr);
    if (val) return `[${attr}="${val}"]`;
  }

  // aria-label
  const label = el.getAttribute('aria-label');
  if (label) return `[aria-label="${label}"]`;

  // name attribute (forms)
  const name = el.getAttribute('name');
  if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;

  // Unique class
  if (el.classList.length > 0) {
    for (let i = 0; i < el.classList.length; i++) {
      const cls = el.classList[i];
      if (document.querySelectorAll(`.${cls}`).length === 1) {
        return `.${cls}`;
      }
    }
  }

  // Fallback: nth-child path
  const path: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.documentElement) {
    const parent: Element | null = current.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter(
      (c: Element) => c.tagName === current!.tagName,
    );
    if (siblings.length === 1) {
      path.unshift(current.tagName.toLowerCase());
    } else {
      const index = siblings.indexOf(current) + 1;
      path.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${index})`);
    }
    current = parent;
  }
  return path.join(' > ');
}

/**
 * Start recording DOM actions. Returns a stop function.
 */
export function startRecording(targetDocument: Document = document): {
  stop: () => RecordedAction[];
  getActions: () => RecordedAction[];
} {
  const actions: RecordedAction[] = [];
  const startTime = Date.now();

  function record(action: Omit<RecordedAction, 'timestamp'>) {
    actions.push({ ...action, timestamp: Date.now() - startTime } as RecordedAction);
  }

  function handleClick(e: Event) {
    const el = e.target as Element;
    if (!el?.tagName) return;
    record({
      type: 'click',
      target: {
        selector: selectorFor(el),
        tag: el.tagName.toLowerCase(),
        text: (el as HTMLElement).innerText?.slice(0, 50),
      },
    });
  }

  function handleInput(e: Event) {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (!el?.tagName) return;
    const type = el.tagName === 'SELECT' ? 'select' : 'fill';
    record({
      type,
      target: {
        selector: selectorFor(el),
        tag: el.tagName.toLowerCase(),
        attributes: { type: el.type ?? '' },
      },
      value: el.value,
    });
  }

  targetDocument.addEventListener('click', handleClick, true);
  targetDocument.addEventListener('change', handleInput, true);

  return {
    stop() {
      targetDocument.removeEventListener('click', handleClick, true);
      targetDocument.removeEventListener('change', handleInput, true);
      return actions;
    },
    getActions() {
      return [...actions];
    },
  };
}

/**
 * Build a prompt to condense recorded actions into clean JS.
 */
export function buildCondensePrompt(actions: RecordedAction[], scriptName: string): string {
  const lines = actions.map((a) => {
    switch (a.type) {
      case 'click':
        return `CLICK ${a.target.selector} // ${a.target.text ?? a.target.tag}`;
      case 'fill':
        return `FILL ${a.target.selector} = "${a.value}"`;
      case 'select':
        return `SELECT ${a.target.selector} = "${a.value}"`;
      case 'navigate':
        return `NAVIGATE ${a.url}`;
      case 'wait':
        return `WAIT ${a.value}ms`;
      default:
        return `${a.type} ${a.target.selector}`;
    }
  });

  return [
    `Condense these recorded browser actions into a clean JavaScript function.`,
    ``,
    `Function name: ${scriptName}`,
    `The function should accept a \`data\` parameter object for any values that should be configurable.`,
    `Use document.querySelector() for element access.`,
    `Add small delays (await new Promise(r => setTimeout(r, 100))) between actions.`,
    `Handle missing elements gracefully (check if element exists before acting).`,
    ``,
    `Recorded actions:`,
    ...lines.map((l) => `  ${l}`),
    ``,
    `Return ONLY the async function body. No function declaration, just the code.`,
    `The function receives (data) as parameter.`,
  ].join('\n');
}

/**
 * Replay a condensed script on the current page.
 */
export async function replayScript(
  code: string,
  data: Record<string, unknown> = {},
): Promise<{ success: boolean; error?: string }> {
  try {
    const fn = new Function('data', `return (async function(data) { ${code} })(data)`) as (
      data: Record<string, unknown>,
    ) => Promise<void>;
    await fn(data);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Replay inside an iframe (same-origin only).
 */
export async function replayInIframe(
  iframe: HTMLIFrameElement,
  code: string,
  data: Record<string, unknown> = {},
): Promise<{ success: boolean; error?: string }> {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return { success: false, error: 'Cannot access iframe document (cross-origin?)' };

    // Inject and run the script in the iframe context
    const script = doc.createElement('script');
    script.textContent = `(async function(data) { ${code} })(${JSON.stringify(data)})`;
    doc.body.appendChild(script);
    doc.body.removeChild(script);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
