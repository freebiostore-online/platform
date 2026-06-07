-- User API Key Vault: encrypted per-user API keys for AI providers.
-- Keys are stored using envelope encryption (AES-256-GCM, per-row DEK wrapped
-- under a master KEK held in env.KEY_ENCRYPTION_KEY). The proxy decrypts at
-- request time and injects the key into upstream API calls.

CREATE TABLE IF NOT EXISTS user_api_keys (
  user_id        TEXT NOT NULL,
  provider       TEXT NOT NULL,
  key_ciphertext BLOB NOT NULL,
  dek_wrapped    BLOB NOT NULL,
  iv             BLOB NOT NULL,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at   INTEGER,
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS proxy_usage (
  user_id TEXT NOT NULL,
  hour    TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, hour)
);
