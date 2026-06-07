/**
 * Extension Storage — chrome.storage.local persistence.
 *
 * Stores automations, test cases, heuristic code, and evolution history.
 * Falls back to localStorage when chrome.storage is unavailable (dev mode).
 */

import type { Automation, ExtensionState } from './types';

const STORAGE_KEY = 'fags-automator';

interface StorageData {
  automations: Automation[];
  recording: boolean;
  currentAutomationId: string | null;
}

const DEFAULT_DATA: StorageData = {
  automations: [],
  recording: false,
  currentAutomationId: null,
};

function getStorage(): Pick<typeof chrome.storage.local, 'get' | 'set'> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return chrome.storage.local;
  }
  // Fallback for dev
  return {
    get: (keys: any) =>
      new Promise((resolve) => {
        const raw = localStorage.getItem(STORAGE_KEY);
        const data = raw ? JSON.parse(raw) : {};
        if (typeof keys === 'string') resolve({ [keys]: data[keys] });
        else if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          for (const k of keys) result[k] = data[k];
          resolve(result);
        } else {
          resolve(data);
        }
      }),
    set: (items: any) =>
      new Promise<void>((resolve) => {
        const raw = localStorage.getItem(STORAGE_KEY);
        const data = raw ? JSON.parse(raw) : {};
        Object.assign(data, items);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        resolve();
      }),
  };
}

export async function loadState(): Promise<StorageData> {
  const storage = getStorage();
  const result = (await storage.get(STORAGE_KEY)) as Record<string, any>;
  return result[STORAGE_KEY] ?? DEFAULT_DATA;
}

export async function saveState(data: Partial<StorageData>): Promise<void> {
  const current = await loadState();
  const updated = { ...current, ...data };
  await getStorage().set({ [STORAGE_KEY]: updated });
}

export async function getAutomations(): Promise<Automation[]> {
  const state = await loadState();
  return state.automations;
}

export async function saveAutomation(automation: Automation): Promise<void> {
  const state = await loadState();
  const idx = state.automations.findIndex((a) => a.id === automation.id);
  if (idx >= 0) {
    state.automations[idx] = automation;
  } else {
    state.automations.push(automation);
  }
  await saveState({ automations: state.automations });
}

export async function deleteAutomation(id: string): Promise<void> {
  const state = await loadState();
  state.automations = state.automations.filter((a) => a.id !== id);
  await saveState({ automations: state.automations });
}

export async function getExtensionState(): Promise<ExtensionState> {
  const state = await loadState();
  const current = state.currentAutomationId
    ? (state.automations.find((a) => a.id === state.currentAutomationId) ?? null)
    : null;
  return {
    recording: state.recording,
    currentAutomation: current,
    automations: state.automations,
  };
}
