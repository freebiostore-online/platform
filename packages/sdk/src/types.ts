/** Configuration for the FreeBioStore SDK. */
export interface AgentConfig {
  /** Unique agent identifier (matches subdomain). */
  agentId: string;
  /** API base URL. Defaults to https://api.freebiostore.online */
  apiBase?: string;
}

/** Model loading configuration. */
export interface ModelConfig {
  /** HuggingFace repo (e.g. 'onnx-community/whisper-small'). */
  repo: string;
  /** Transformers.js task (e.g. 'automatic-speech-recognition'). */
  task?: string;
  /** Preferred device. Falls back to 'wasm' if 'webgpu' unavailable. */
  device?: 'webgpu' | 'wasm' | 'auto';
  /** Quantization format. */
  dtype?: 'fp32' | 'fp16' | 'q8' | 'q4';
  /** Custom model file paths within the repo. */
  files?: string[];
}

export type ModelStatus =
  | { state: 'idle' }
  | { state: 'downloading'; progress: number; totalBytes: number }
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'error'; error: string };

export interface InferenceResult<T = unknown> {
  output: T;
  durationMs: number;
  device: 'webgpu' | 'wasm';
}

export interface OllamaStatus {
  available: boolean;
  models: OllamaModel[];
  endpoint: string;
}

export interface OllamaModel {
  name: string;
  size: number;
  parameterSize: string;
  quantization: string;
}

export interface WorkerMessage {
  type: 'init' | 'generate' | 'progress' | 'result' | 'error';
  [key: string]: unknown;
}

export interface AgentManifest {
  name: string;
  description: string;
  version: string;
  task: string;
  category: AgentCategory;
  models: AgentModelEntry[];
  estimatedDownload: string;
  input: string[];
  output: string[];
  requiresWebGPU: boolean;
  requiresOllama: boolean;
  requiresWebContainers: boolean;
  offlineCapable: boolean;
  desktopOnly: boolean;
}

export interface AgentModelEntry {
  repo: string;
  size: string;
  backend: ('webgpu' | 'wasm')[];
  task: string;
}

export type AgentCategory =
  | 'audio'
  | 'vision'
  | 'text'
  | 'code'
  | 'data'
  | 'productivity'
  | 'creative'
  | 'automation';
