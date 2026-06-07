/**
 * Shared types for the FAGS Automator extension.
 */

/** A single recorded user action. */
export interface RecordedAction {
  type: 'click' | 'fill' | 'select' | 'check' | 'navigate' | 'keypress';
  /** Multiple selector strategies, ordered by resilience. */
  selectors: SelectorStrategy[];
  /** Value for fill/select actions. */
  value?: string;
  /** Key for keypress (e.g. 'Enter', 'Tab'). */
  key?: string;
  /** Milliseconds since previous action. */
  delayMs: number;
  /** Screenshot of the element at record time (data URL, thumbnail). */
  thumbnail?: string;
  /** Human-readable description of what was clicked/filled. */
  label: string;
  /** URL where this action was recorded. */
  url: string;
  /** Timestamp. */
  timestamp: number;
}

/** A selector strategy with a resilience tier. */
export interface SelectorStrategy {
  /** How resilient this selector is to page changes. */
  tier: 'id' | 'testid' | 'aria' | 'label' | 'text' | 'css' | 'xpath';
  /** The actual selector string. */
  value: string;
  /** Confidence that this selector will work on similar pages (0-1). */
  confidence: number;
}

/** A complete automation flow (sequence of actions). */
export interface Automation {
  id: string;
  name: string;
  /** URL pattern this automation applies to (glob). */
  urlPattern: string;
  /** The site/system this was trained for. */
  site: string;
  /** Recorded actions. */
  actions: RecordedAction[];
  /** Generated heuristic code that replays the automation. */
  heuristicCode?: string;
  /** Test cases: snapshots of HTML + expected action. */
  testCases: TestCase[];
  /** Evolution history. */
  history: EvolutionEntry[];
  /** Current accuracy against test cases. */
  accuracy: number;
  createdAt: number;
  updatedAt: number;
}

/** A test case for validating the heuristic. */
export interface TestCase {
  id: string;
  /** Snapshot of the page HTML (or relevant section). */
  html: string;
  /** The URL this was captured from. */
  url: string;
  /** What the heuristic should produce for this HTML. */
  expectedAction: ExpectedAction;
  /** Was this a failure case that triggered retraining? */
  isFailureCase: boolean;
  timestamp: number;
}

export interface ExpectedAction {
  type: RecordedAction['type'];
  /** Which selector should match. */
  selector: string;
  value?: string;
}

export interface EvolutionEntry {
  version: number;
  score: number;
  testCount: number;
  source: 'built-in' | 'ollama' | 'openai' | 'manual';
  timestamp: number;
}

/** Messages between content script, background, and popup/sidepanel. */
export type ExtMessage =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'RECORDING_STATUS'; recording: boolean }
  | { type: 'ACTION_RECORDED'; action: RecordedAction }
  | { type: 'REPLAY'; automation: Automation }
  | { type: 'REPLAY_STEP'; index: number; status: 'ok' | 'fail'; selector?: string }
  | { type: 'REPLAY_DONE'; success: boolean; failedStep?: number }
  | { type: 'CAPTURE_HTML'; html: string; url: string }
  | { type: 'GET_STATE' }
  | { type: 'STATE'; state: ExtensionState };

export interface ExtensionState {
  recording: boolean;
  currentAutomation: Automation | null;
  automations: Automation[];
}
