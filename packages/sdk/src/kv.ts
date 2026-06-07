/** Per-user KV storage — vendored from FAS SDK pattern. */
export class Kv {
  private apiBase: string;
  private agentId: string;

  constructor(apiBase: string, agentId: string) {
    this.apiBase = apiBase;
    this.agentId = agentId;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const res = await fetch(
      `${this.apiBase}/v1/kv?app=${this.agentId}&key=${encodeURIComponent(key)}`,
      { credentials: 'include' },
    );
    if (!res.ok) return null;
    return (await res.json()).value;
  }

  async set(key: string, value: unknown): Promise<void> {
    await fetch(`${this.apiBase}/v1/kv`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: this.agentId, key, value }),
    });
  }

  async delete(key: string): Promise<void> {
    await fetch(`${this.apiBase}/v1/kv`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: this.agentId, key }),
    });
  }

  async list(): Promise<string[]> {
    const res = await fetch(`${this.apiBase}/v1/kv/keys?app=${this.agentId}`, {
      credentials: 'include',
    });
    if (!res.ok) return [];
    return (await res.json()).keys;
  }
}
