PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS account_request_extended(
 request_id TEXT PRIMARY KEY REFERENCES account_requests(id) ON DELETE CASCADE,
 school_name TEXT NOT NULL,class_or_major TEXT NOT NULL,employment_status TEXT NOT NULL,
 workplace_name TEXT NOT NULL,work_department TEXT NOT NULL,job_title TEXT NOT NULL,
 guardian_date_of_birth TEXT,guardian_id_number TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS account_request_orgs(
 request_id TEXT NOT NULL REFERENCES account_requests(id) ON DELETE CASCADE,
 org_node_id TEXT NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
 is_primary INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(request_id,org_node_id)
);
CREATE INDEX IF NOT EXISTS idx_request_orgs_org ON account_request_orgs(org_node_id,request_id);
INSERT OR IGNORE INTO schema_version(version) VALUES(10);
