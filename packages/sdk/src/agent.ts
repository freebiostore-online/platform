import { Auth } from './auth.js';
import { Kv } from './kv.js';
import { ModelLoader } from './model.js';
import { ModelCache } from './model-cache.js';
import { OllamaClient } from './ollama.js';
import { ResultStore } from './result-store.js';
import { Rooms } from './rooms.js';
import type { AgentConfig } from './types.js';

const DEFAULT_API = 'https://api.freebiostore.online';

export interface FreeBioStore {
  readonly agentId: string;
  readonly auth: Auth;
  readonly kv: Kv;
  readonly rooms: Rooms;
  readonly models: ModelLoader;
  readonly ollama: OllamaClient;
  readonly results: ResultStore;
  readonly cache: ModelCache;
}

export function initAgent(config: AgentConfig): FreeBioStore {
  const apiBase = config.apiBase ?? DEFAULT_API;
  const { agentId } = config;

  return {
    agentId,
    auth: new Auth(apiBase, agentId),
    kv: new Kv(apiBase, agentId),
    rooms: new Rooms(apiBase, agentId),
    models: new ModelLoader(),
    ollama: new OllamaClient(),
    results: new ResultStore(agentId),
    cache: new ModelCache(),
  };
}
