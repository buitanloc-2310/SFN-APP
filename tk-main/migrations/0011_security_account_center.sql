CREATE TABLE IF NOT EXISTS auth_rate_limits(
  rate_key TEXT PRIMARY KEY,
  window_start TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempts INTEGER NOT NULL DEFAULT 0,
  blocked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_blocked ON auth_rate_limits(blocked_until);

CREATE TABLE IF NOT EXISTS password_reset_tokens(
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_reset_account ON password_reset_tokens(account_id,created_at DESC);

CREATE TABLE IF NOT EXISTS security_events(
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip_hint TEXT,
  user_agent TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_security_events_account ON security_events(account_id,created_at DESC);
