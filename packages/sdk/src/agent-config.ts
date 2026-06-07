/**
 * Agent Config & Instance System
 *
 * Agents are base code + config overlay. The base is the npm package.
 * The config makes it yours — custom prompts, extra fields, evolved code.
 *
 * Two modes:
 * 1. Portable: config.json checked into your repo (offline, no server)
 * 2. Hosted: config stored in FAGS D1, loaded by instance ID (live updates)
 *
 * Training flow:
 *   Console UI → upload examples → built-in AI evolves code →
 *   eval → iterate → export config (JSON or instance ID)
 */

export interface AgentConfig {
  /** Base agent this config extends. */
  baseAgent: string;
  /** Version of the base agent this was trained against. */
  baseVersion: string;
  /** Human-readable name for this instance. */
  instanceName: string;

  /** System prompt override (for built-in AI / Ollama agents). */
  systemPrompt?: string;
  /** Custom parameters passed to the agent's run() function. */
  params?: Record<string, unknown>;
  /** Extra field definitions (for extraction agents like resume-parser). */
  extraFields?: FieldDef[];
  /** Custom section/pattern overrides. */
  customPatterns?: Record<string, string>;

  /** Evolved heuristic code that overrides the base agent's logic. */
  evolvedCode?: string;

  /** Training examples used to evolve this config. */
  examples?: TrainingExample[];
  /** Evolution history (version → score progression). */
  evolutionHistory?: EvolutionEntry[];

  /** Metadata. */
  createdAt: number;
  updatedAt: number;
  trainedOn: number;
  accuracy: number;
}

export interface FieldDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  pattern?: string;
}

export interface TrainingExample {
  input: unknown;
  expectedOutput: unknown;
  weight?: number;
}

export interface EvolutionEntry {
  version: number;
  score: number;
  examplesUsed: number;
  change: string;
  timestamp: number;
}

/**
 * Create an agent instance with a config overlay.
 *
 * The config can override the base agent's behavior via:
 * - evolvedCode: replaces the base heuristic with custom code
 * - systemPrompt: overrides the LLM prompt for built-in AI agents
 * - params/extraFields: passed to the agent's run() function
 */
export function createAgentInstance<TInput = unknown, TOutput = unknown>(
  baseRun: (input: TInput, config?: AgentConfig) => TOutput,
  config: AgentConfig,
): AgentInstance<TInput, TOutput> {
  // If config has evolved code, compile it as the runner
  let runner = baseRun;
  if (config.evolvedCode) {
    try {
      const evolved = new Function('input', 'config', config.evolvedCode) as (
        input: TInput,
        config?: AgentConfig,
      ) => TOutput;
      runner = evolved;
    } catch (e) {
      console.warn('[AgentInstance] Failed to compile evolved code, using base:', e);
    }
  }

  return {
    run(input: TInput): TOutput {
      return runner(input, config);
    },
    config,
    baseAgent: config.baseAgent,
    instanceName: config.instanceName,
  };
}

export interface AgentInstance<TInput = unknown, TOutput = unknown> {
  run(input: TInput): TOutput;
  config: AgentConfig;
  baseAgent: string;
  instanceName: string;
}

/**
 * Load a hosted agent instance config from the FAGS API.
 */
export async function loadAgentConfig(
  baseAgent: string,
  instanceId: string,
  apiBase = 'https://api.freebiostore.online',
): Promise<AgentConfig> {
  const res = await fetch(`${apiBase}/v1/agents/${baseAgent}/instances/${instanceId}`);
  if (!res.ok) throw new Error(`Failed to load instance ${instanceId}: ${res.status}`);
  return res.json();
}

/**
 * Save/update a hosted agent instance config.
 */
export async function saveAgentConfig(
  config: AgentConfig,
  instanceId: string | undefined,
  apiBase = 'https://api.freebiostore.online',
  token?: string,
): Promise<{ instanceId: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(
    `${apiBase}/v1/agents/${config.baseAgent}/instances${instanceId ? `/${instanceId}` : ''}`,
    {
      method: instanceId ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(config),
    },
  );
  if (!res.ok) throw new Error(`Failed to save config: ${res.status}`);
  return res.json();
}

/**
 * Export a config as a portable JSON string.
 */
export function exportConfig(config: AgentConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Import a config from a portable JSON string.
 */
export function importConfig(json: string): AgentConfig {
  const config = JSON.parse(json);
  if (!config.baseAgent || !config.instanceName) {
    throw new Error('Invalid config: missing baseAgent or instanceName');
  }
  return config as AgentConfig;
}

/**
 * Create a blank config for a base agent.
 */
export function createBlankConfig(
  baseAgent: string,
  baseVersion: string,
  instanceName: string,
): AgentConfig {
  return {
    baseAgent,
    baseVersion,
    instanceName,
    examples: [],
    evolutionHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    trainedOn: 0,
    accuracy: 0,
  };
}
