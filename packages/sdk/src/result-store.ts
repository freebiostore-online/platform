/**
 * Persists agent results in IndexedDB.
 * Each agent gets its own object store.
 */
export class ResultStore {
  private agentId: string;
  private dbPromise: Promise<IDBDatabase>;

  constructor(agentId: string) {
    this.agentId = agentId;
    this.dbPromise = this.open();
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`fags-results-${this.agentId}`, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('results')) {
          db.createObjectStore('results', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async save(id: string, data: unknown): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('results', 'readwrite');
      tx.objectStore('results').put({ id, data, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async load<T = unknown>(id: string): Promise<T | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('results', 'readonly');
      const req = tx.objectStore('results').get(id);
      req.onsuccess = () => resolve(req.result?.data ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async list(): Promise<{ id: string; savedAt: number }[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('results', 'readonly');
      const req = tx.objectStore('results').getAll();
      req.onsuccess = () => resolve(req.result.map((r: any) => ({ id: r.id, savedAt: r.savedAt })));
      req.onerror = () => reject(req.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('results', 'readwrite');
      tx.objectStore('results').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('results', 'readwrite');
      tx.objectStore('results').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
