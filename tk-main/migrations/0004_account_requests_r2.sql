PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS account_requests(
 id TEXT PRIMARY KEY,
 request_code TEXT NOT NULL UNIQUE,
 full_name TEXT NOT NULL,
 display_name TEXT NOT NULL,
 date_of_birth TEXT NOT NULL,
 gender TEXT NOT NULL,
 nationality TEXT NOT NULL,
 id_number TEXT NOT NULL,
 id_issue_date TEXT NOT NULL,
 id_issue_place TEXT NOT NULL,
 email TEXT NOT NULL,
 phone TEXT NOT NULL,
 permanent_address TEXT NOT NULL,
 temporary_address TEXT NOT NULL,
 avatar_url TEXT NOT NULL,
 desired_username TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 admin_note TEXT,
 reviewed_by_account_id TEXT REFERENCES accounts(id),
 reviewed_at TEXT,
 approved_person_id TEXT REFERENCES people(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_account_requests_status_created ON account_requests(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_requests_email ON account_requests(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_requests_pending_identity ON account_requests(id_number) WHERE status='pending';

INSERT OR IGNORE INTO permissions(id,code,name) VALUES
('perm_request_manage','request.manage','Phê duyệt yêu cầu cấp tài khoản');
INSERT OR IGNORE INTO role_permissions(role_id,permission_id) SELECT 'role_super_admin',id FROM permissions WHERE code='request.manage';
INSERT OR IGNORE INTO role_permissions(role_id,permission_id) SELECT 'role_network_admin',id FROM permissions WHERE code='request.manage';
INSERT OR IGNORE INTO schema_version(version) VALUES(4);
