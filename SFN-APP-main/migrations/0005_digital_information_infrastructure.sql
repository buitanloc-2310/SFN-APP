-- Sky First Digital Information Infrastructure — 2026-10
-- Additive migration: preserves every legacy credential/code already issued.

ALTER TABLE submissions ADD COLUMN next_action TEXT;
ALTER TABLE submissions ADD COLUMN result_summary TEXT;
ALTER TABLE submissions ADD COLUMN public_meta_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS case_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_code TEXT NOT NULL,
  event_type TEXT NOT NULL,
  public_label TEXT NOT NULL,
  public_note TEXT,
  status TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(submission_code) REFERENCES submissions(code) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_case_events_submission ON case_events(submission_code, created_at);

ALTER TABLE files ADD COLUMN sha256 TEXT;
ALTER TABLE files ADD COLUMN upload_state TEXT NOT NULL DEFAULT 'ready';
ALTER TABLE files ADD COLUMN replaced_by_file_id TEXT;
ALTER TABLE files ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_files_sha256 ON files(sha256);
CREATE INDEX IF NOT EXISTS idx_files_submission ON files(submission_code, field_key);

CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  submission_code TEXT,
  field_key TEXT,
  filename TEXT NOT NULL,
  mime TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  client_sha256 TEXT,
  r2_key TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'created',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalized_at TEXT,
  FOREIGN KEY(submission_code) REFERENCES submissions(code) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expiry ON upload_sessions(expires_at, state);

ALTER TABLE certificates ADD COLUMN public_id TEXT;
ALTER TABLE certificates ADD COLUMN legacy_code TEXT;
ALTER TABLE certificates ADD COLUMN supersedes_id TEXT;
ALTER TABLE certificates ADD COLUMN superseded_by_id TEXT;
ALTER TABLE certificates ADD COLUMN revoked_at TEXT;
ALTER TABLE certificates ADD COLUMN revocation_reason TEXT;
ALTER TABLE certificates ADD COLUMN immutable_snapshot_json TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_public_id ON certificates(public_id) WHERE public_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_certificates_code_status ON certificates(code, status);

CREATE TABLE IF NOT EXISTS form_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(form_id, version),
  FOREIGN KEY(form_id) REFERENCES forms(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS form_drafts (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  resume_token_hash TEXT NOT NULL,
  answers_json TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(form_id) REFERENCES forms(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_form_drafts_expiry ON form_drafts(expires_at);

CREATE TABLE IF NOT EXISTS portal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  category TEXT,
  route TEXT,
  outcome TEXT,
  device_class TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_portal_events_name_time ON portal_events(event_name, created_at);
