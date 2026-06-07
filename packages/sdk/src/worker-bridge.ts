import type { WorkerMessage } from './types.js';

/**
 * Manages communication with a Web Worker that runs AI inference.
 * The worker handles model loading + inference off the main thread.
 */
export class WorkerBridge {
  private worker: Worker | null = null;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private listeners = new Map<string, Set<(data: any) => void>>();
  private nextId = 0;

  constructor(private workerUrl: string) {}

  /** Start the worker. */
  start(): void {
    this.worker = new Worker(this.workerUrl, { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => this.handleMessage(e.data);
    this.worker.onerror = (e) => {
      console.error('[WorkerBridge] Worker error:', e.message);
    };
  }

  /** Send a message to the worker and await a response. */
  async send<T = unknown>(type: string, data?: Record<string, unknown>): Promise<T> {
    if (!this.worker) throw new Error('Worker not started. Call start() first.');

    const id = String(this.nextId++);
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ type, id, ...data });
    });
  }

  /** Send a fire-and-forget message. */
  post(type: string, data?: Record<string, unknown>): void {
    this.worker?.postMessage({ type, ...data });
  }

  /** Listen for a specific message type from the worker. */
  on(type: string, fn: (data: any) => void): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
    return () => this.listeners.get(type)?.delete(fn);
  }

  /** Stop the worker. */
  stop(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const { reject } of this.pending.values()) {
      reject(new Error('Worker terminated'));
    }
    this.pending.clear();
  }

  private handleMessage(msg: WorkerMessage) {
    // If it has an id, resolve the pending promise
    const id = msg.id as string | undefined;
    if (id && this.pending.has(id)) {
      const { resolve, reject } = this.pending.get(id)!;
      this.pending.delete(id);
      if (msg.type === 'error') {
        reject(new Error(msg.error as string));
      } else {
        resolve(msg);
      }
      return;
    }

    // Otherwise, broadcast to type listeners
    const handlers = this.listeners.get(msg.type);
    if (handlers) for (const fn of handlers) fn(msg);
  }
}
