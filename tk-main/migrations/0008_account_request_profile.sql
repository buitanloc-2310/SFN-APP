PRAGMA foreign_keys = ON;

-- Companion table keeps education/work fields without risky ALTER TABLE on an existing production table.
CREATE TABLE IF NOT EXISTS account_request_profiles(
  request_id TEXT PRIMARY KEY REFERENCES account_requests(id) ON DELETE CASCADE,
  education_or_work_type TEXT NOT NULL,
  school_or_workplace TEXT NOT NULL,
  class_or_major TEXT,
  education_status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO schema_version(version) VALUES(8);
