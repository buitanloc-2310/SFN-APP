PRAGMA foreign_keys = ON;
-- Non-destructive integration registry: keeps Xanh records separate from native CTT submissions.
CREATE TABLE IF NOT EXISTS xanh_external_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'xanh-sky-first',
  external_code TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  form_name TEXT NOT NULL DEFAULT '',
  external_status TEXT NOT NULL DEFAULT 'Đã tiếp nhận',
  source_submitted_at TEXT,
  source_tracking_url TEXT NOT NULL DEFAULT '',
  payload_hash TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source, external_code)
);
CREATE INDEX IF NOT EXISTS idx_xanh_external_submissions_received ON xanh_external_submissions(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_xanh_external_submissions_email ON xanh_external_submissions(email);
CREATE TABLE IF NOT EXISTS integration_nonces (
  nonce TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_integration_nonces_created ON integration_nonces(created_at);
