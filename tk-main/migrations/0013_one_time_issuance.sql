-- V6: nghiệp vụ cấp phát một lần, độc lập hoàn toàn với tài khoản/thành viên.
CREATE TABLE IF NOT EXISTS one_time_credentials(
 id TEXT PRIMARY KEY,
 credential_type TEXT NOT NULL DEFAULT 'event_card',
 event_name TEXT NOT NULL,
 full_name TEXT NOT NULL,
 role_label TEXT,
 photo_url TEXT,
 card_number TEXT NOT NULL UNIQUE,
 issued_at TEXT NOT NULL,
 expires_at TEXT,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','used','expired','revoked')),
 verify_token TEXT NOT NULL UNIQUE,
 card_type_id TEXT REFERENCES card_types(id) ON DELETE SET NULL,
 notes TEXT,
 metadata_json TEXT NOT NULL DEFAULT '{}',
 created_by_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_one_time_credentials_event ON one_time_credentials(event_name);
CREATE INDEX IF NOT EXISTS idx_one_time_credentials_status ON one_time_credentials(status);
CREATE INDEX IF NOT EXISTS idx_one_time_credentials_expires ON one_time_credentials(expires_at);
