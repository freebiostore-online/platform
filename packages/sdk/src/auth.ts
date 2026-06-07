/** GitHub OAuth auth client — vendored from FAS SDK pattern. */
export class Auth {
  private apiBase: string;
  private agentId: string;
  private listeners: Set<(user: AuthUser | null) => void> = new Set();
  private _user: AuthUser | null = null;

  constructor(apiBase: string, agentId: string) {
    this.apiBase = apiBase;
    this.agentId = agentId;
  }

  get user() {
    return this._user;
  }

  async signIn(provider: 'github' = 'github'): Promise<AuthUser | null> {
    const res = await fetch(`${this.apiBase}/auth/${provider}?app=${this.agentId}`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    // OAuth redirect flow — open popup or redirect
    if (data.url) {
      window.location.href = data.url;
      return null;
    }
    this._user = data.user;
    this.notify();
    return this._user;
  }

  async signOut(): Promise<void> {
    await fetch(`${this.apiBase}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    this._user = null;
    this.notify();
  }

  async me(): Promise<AuthUser | null> {
    try {
      const res = await fetch(`${this.apiBase}/auth/me`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      this._user = (await res.json()).user;
      this.notify();
      return this._user;
    } catch {
      return null;
    }
  }

  onAuthChange(fn: (user: AuthUser | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn(this._user);
  }
}

export interface AuthUser {
  id: string;
  name: string;
  avatar: string;
  email?: string;
}
