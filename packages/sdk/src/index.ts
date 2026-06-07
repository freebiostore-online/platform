// @freebiostore/sdk — main entry

export type { FreeBioStore } from './agent.js';
export { initAgent } from './agent.js';
export type {
  AgentConfig,
  AgentInstance,
  EvolutionEntry,
  FieldDef,
  TrainingExample,
} from './agent-config.js';
// Agent config & instances — customizable, trainable agents
export {
  createAgentInstance,
  createBlankConfig,
  exportConfig,
  importConfig,
  loadAgentConfig,
  saveAgentConfig,
} from './agent-config.js';
export type { EvolveResult } from './agent-evolve.js';
// Agent evolution — train agents using built-in AI
export { evolveAgentConfig } from './agent-evolve.js';
// Core primitives (vendored from FAS pattern)
export { Auth } from './auth.js';
export type { BuiltInAvailability, BuiltInSession } from './built-in-ai.js';
// Built-in AI (Chrome Gemini Nano / Edge Aion) — zero download
export {
  createPromptSession,
  createRewriter,
  createSummarizer,
  createTranslator,
  createWriter,
  detectBuiltInAI,
  smartPrompt,
} from './built-in-ai.js';
export type { EvalResult, HeuristicExample, HeuristicSpec, HeuristicVersion } from './heuristic.js';
// Heuristic agents — living code that evolves without runtime LLM
export { buildEvolvePrompt, evaluateHeuristic, extractCode } from './heuristic.js';
export { Kv } from './kv.js';
// LangChain.js integration — proxy-backed chat + LangChain config
export type { FagsChatOptions } from './langchain.js';
export { createFagsChat, getFagsLangChainConfig } from './langchain.js';
// Mobile Mirror — pair mobile with desktop agent tab via QR/link
export type {
  MirrorConfig,
  MirrorInstance,
  MirrorMessage,
  MobileMirrorConfig,
  MobileMirrorInstance,
} from './mirror.js';
export { createMirror, joinMirror } from './mirror.js';
// Agent-specific
export { ModelLoader } from './model.js';
export { ModelCache } from './model-cache.js';
export { OllamaClient } from './ollama.js';
export { ResultStore } from './result-store.js';
export { Rooms } from './rooms.js';
export type {
  AgentConfig as AgentInitConfig,
  InferenceResult,
  ModelConfig,
  ModelStatus,
  OllamaModel,
  OllamaStatus,
} from './types.js';
export { WorkerBridge } from './worker-bridge.js';
// Molecule analysis — SMILES parser, property calculator, drug-likeness
export { Molecule } from './molecule.js';
