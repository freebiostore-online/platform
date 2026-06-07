/**
 * Heuristic Replay Engine
 *
 * Replays automations by trying selector strategies in order.
 * When a selector fails, falls through to the next strategy.
 * When ALL strategies fail, captures the failure as a test case
 * for retraining.
 *
 * Two modes:
 * 1. Selector-based replay (default): tries recorded selectors
 * 2. Heuristic replay: runs trained JS code that finds elements
 */

import type { RecordedAction, SelectorStrategy, TestCase } from './types';

export interface ReplayResult {
  success: boolean;
  stepsCompleted: number;
  stepsTotal: number;
  failures: ReplayFailure[];
}

export interface ReplayFailure {
  stepIndex: number;
  action: RecordedAction;
  /** The HTML around the expected element — used as training data. */
  htmlSnapshot: string;
  url: string;
  triedSelectors: string[];
}

export interface ReplayCallbacks {
  onStep?: (
    index: number,
    action: RecordedAction,
    status: 'ok' | 'fail',
    selector?: string,
  ) => void;
  onDone?: (result: ReplayResult) => void;
}

/**
 * Replay an automation on the current page.
 */
export async function replay(
  actions: RecordedAction[],
  heuristicCode: string | undefined,
  callbacks?: ReplayCallbacks,
): Promise<ReplayResult> {
  const failures: ReplayFailure[] = [];
  let completed = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // Wait for the delay between actions (min 50ms)
    await sleep(Math.max(50, Math.min(action.delayMs, 3000)));

    // Try to find the element
    const el = heuristicCode
      ? findElementByHeuristic(heuristicCode, action, i)
      : findElementBySelectors(action.selectors);

    if (!el) {
      const failure: ReplayFailure = {
        stepIndex: i,
        action,
        htmlSnapshot: captureNearbyHtml(),
        url: location.href,
        triedSelectors: action.selectors.map((s) => s.value),
      };
      failures.push(failure);
      callbacks?.onStep?.(i, action, 'fail');
      break; // Stop on first failure
    }

    // Execute the action
    try {
      await executeAction(el, action);
      completed++;
      const usedSelector =
        action.selectors.find((s) => resolveSelector(s) === el)?.value ?? 'heuristic';
      callbacks?.onStep?.(i, action, 'ok', usedSelector);
    } catch {
      failures.push({
        stepIndex: i,
        action,
        htmlSnapshot: captureNearbyHtml(),
        url: location.href,
        triedSelectors: action.selectors.map((s) => s.value),
      });
      callbacks?.onStep?.(i, action, 'fail');
      break;
    }
  }

  const result: ReplayResult = {
    success: failures.length === 0,
    stepsCompleted: completed,
    stepsTotal: actions.length,
    failures,
  };

  callbacks?.onDone?.(result);
  return result;
}

/**
 * Find an element by trying selector strategies in order.
 * Returns the first match, prioritizing high-confidence selectors.
 */
function findElementBySelectors(strategies: SelectorStrategy[]): Element | null {
  // Sort by confidence descending
  const sorted = [...strategies].sort((a, b) => b.confidence - a.confidence);

  for (const strategy of sorted) {
    const el = resolveSelector(strategy);
    if (el && isVisible(el)) return el;
  }
  return null;
}

/**
 * Find an element using trained heuristic code.
 */
function findElementByHeuristic(
  code: string,
  action: RecordedAction,
  stepIndex: number,
): Element | null {
  try {
    const fn = new Function('document', 'action', 'stepIndex', code);
    const result = fn(document, action, stepIndex);
    if (result instanceof Element) return result;
    if (typeof result === 'string') return document.querySelector(result);
    return null;
  } catch {
    // Fall back to selector-based
    return findElementBySelectors(action.selectors);
  }
}

/**
 * Resolve a single selector strategy to an element.
 */
function resolveSelector(strategy: SelectorStrategy): Element | null {
  const { tier, value } = strategy;

  if (tier === 'text') {
    // text:Button Text → find by text content
    const text = value.slice(5); // strip "text:"
    return findByText(text);
  }

  if (tier === 'label') {
    // label-text:Email → find the input associated with this label
    const labelText = value.slice(11); // strip "label-text:"
    return findByLabel(labelText);
  }

  // Standard CSS selector
  try {
    return document.querySelector(value);
  } catch {
    return null;
  }
}

function findByText(text: string): Element | null {
  const lower = text.toLowerCase().trim();
  // Try buttons and links first
  const candidates = document.querySelectorAll('button, a, [role="button"], input[type="submit"]');
  for (const el of candidates) {
    const elText = el.textContent?.trim().toLowerCase();
    if (elText === lower || elText?.includes(lower)) return el;
  }
  // Broader search
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent?.trim().toLowerCase().includes(lower)) {
      const parent = node.parentElement;
      if (parent && isInteractive(parent)) return parent;
    }
  }
  return null;
}

function findByLabel(labelText: string): Element | null {
  const lower = labelText.toLowerCase().trim();
  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    if (label.textContent?.trim().toLowerCase().includes(lower)) {
      // label[for]
      const forId = label.getAttribute('for');
      if (forId) {
        const el = document.getElementById(forId);
        if (el) return el;
      }
      // Nested input
      const input = label.querySelector('input, textarea, select');
      if (input) return input;
    }
  }
  return null;
}

/**
 * Execute an action on an element.
 */
async function executeAction(el: Element, action: RecordedAction): Promise<void> {
  // Scroll into view
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(100);

  switch (action.type) {
    case 'click':
      (el as HTMLElement).click();
      break;

    case 'fill': {
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      // Focus, clear, set value, dispatch events (simulates real typing)
      input.focus();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // Type character by character for sites that listen to keydown
      for (const char of action.value ?? '') {
        input.value += char;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(15 + Math.random() * 30); // Human-like typing speed
      }
      input.dispatchEvent(new Event('change', { bubbles: true }));
      break;
    }

    case 'select': {
      const select = el as HTMLSelectElement;
      select.value = action.value ?? '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      break;
    }

    case 'check': {
      const checkbox = el as HTMLInputElement;
      const shouldBeChecked = action.value === 'true';
      if (checkbox.checked !== shouldBeChecked) {
        checkbox.click();
      }
      break;
    }

    case 'keypress': {
      const key = action.key ?? 'Enter';
      (el as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      (el as HTMLElement).dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      if (key === 'Enter') {
        // Also try form submission
        const form = el.closest('form');
        if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
      }
      break;
    }
  }
}

/**
 * Capture nearby HTML for training data when a step fails.
 */
function captureNearbyHtml(): string {
  // Capture the main content area, stripping scripts/styles
  const main = document.querySelector(
    'main, [role="main"], #main, .main, #content, .content, #app, #root',
  );
  const target = main ?? document.body;
  const clone = target.cloneNode(true) as Element;
  clone.querySelectorAll('script, style, link, noscript, svg').forEach((n) => n.remove());
  // Truncate to 10KB
  const html = clone.innerHTML;
  return html.length > 10240 ? `${html.slice(0, 10240)}<!-- truncated -->` : html;
}

/**
 * Convert a replay failure into a test case for retraining.
 */
export function failureToTestCase(failure: ReplayFailure): TestCase {
  return {
    id: crypto.randomUUID(),
    html: failure.htmlSnapshot,
    url: failure.url,
    expectedAction: {
      type: failure.action.type,
      selector: failure.action.selectors[0]?.value ?? '',
      value: failure.action.value,
    },
    isFailureCase: true,
    timestamp: Date.now(),
  };
}

// --- Helpers ---

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function isInteractive(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  return (
    ['a', 'button', 'input', 'textarea', 'select'].includes(tag) ||
    el.getAttribute('role') === 'button' ||
    el.hasAttribute('onclick') ||
    (el as HTMLElement).tabIndex >= 0
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
