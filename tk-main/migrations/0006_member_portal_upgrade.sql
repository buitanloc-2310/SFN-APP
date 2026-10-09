PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS account_requests_v6(
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
 desired_username TEXT,
 target_org_node_id TEXT REFERENCES org_nodes(id) ON DELETE SET NULL,
 guardian_full_name TEXT,
 guardian_relationship TEXT,
 guardian_phone TEXT,
 guardian_email TEXT,
 guardian_lives_together INTEGER NOT NULL DEFAULT 0,
 guardian_address TEXT,
 privacy_consent INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','supplement','approved','rejected')),
 admin_note TEXT,
 reviewed_by_account_id TEXT REFERENCES accounts(id),
 reviewed_at TEXT,
 approved_person_id TEXT REFERENCES people(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO account_requests_v6(
 id,request_code,full_name,display_name,date_of_birth,gender,nationality,id_number,id_issue_date,id_issue_place,
 email,phone,permanent_address,temporary_address,avatar_url,desired_username,status,admin_note,reviewed_by_account_id,
 reviewed_at,approved_person_id,created_at,updated_at
)
SELECT id,request_code,full_name,display_name,date_of_birth,gender,nationality,id_number,id_issue_date,id_issue_place,
 email,phone,permanent_address,temporary_address,avatar_url,desired_username,status,admin_note,reviewed_by_account_id,
 reviewed_at,approved_person_id,created_at,updated_at
FROM account_requests;

DROP TABLE account_requests;
ALTER TABLE account_requests_v6 RENAME TO account_requests;
CREATE INDEX IF NOT EXISTS idx_account_requests_status_created ON account_requests(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_requests_email ON account_requests(email);
CREATE INDEX IF NOT EXISTS idx_account_requests_target_org ON account_requests(target_org_node_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_requests_pending_identity ON account_requests(id_number) WHERE status IN ('pending','supplement');

ALTER TABLE org_nodes ADD COLUMN description TEXT;
ALTER TABLE org_nodes ADD COLUMN founded_at TEXT;
ALTER TABLE org_nodes ADD COLUMN term_label TEXT;
ALTER TABLE org_nodes ADD COLUMN responsible_person_id TEXT REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE org_nodes ADD COLUMN deleted_at TEXT;

INSERT OR IGNORE INTO roles(id,code,name,description,system_role) VALUES
('role_unit_admin','UNIT_ADMIN','Unit Admin','Quản trị đơn vị trực thuộc theo phạm vi được cấp',1),
('role_department_admin','DEPARTMENT_ADMIN','Department Admin','Quản trị Văn phòng/Ban/Phòng theo phạm vi được cấp',1);

INSERT OR IGNORE INTO permissions(id,code,name) VALUES
('perm_calendar_view','calendar.view','Xem lịch'),
('perm_calendar_manage','calendar.manage','Quản lý lịch'),
('perm_org_delete','org.delete','Xóa/khôi phục đơn vị');

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT 'role_network_admin',id FROM permissions WHERE code IN ('calendar.view','calendar.manage','org.delete');
INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT 'role_unit_admin',id FROM permissions WHERE code IN ('member.view','member.edit','account.manage','goal.manage','task.manage','activity.manage','certificate.manage','achievement.manage','card.manage','request.manage','org.manage','org.delete','calendar.view','calendar.manage');
INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT 'role_department_admin',id FROM permissions WHERE code IN ('member.view','member.edit','account.manage','goal.manage','task.manage','activity.manage','certificate.manage','achievement.manage','card.manage','request.manage','org.manage','org.delete','calendar.view','calendar.manage');

CREATE TABLE IF NOT EXISTS calendar_events(
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 event_type TEXT NOT NULL DEFAULT 'other',
 description TEXT,
 starts_at TEXT NOT NULL,
 ends_at TEXT,
 org_node_id TEXT REFERENCES org_nodes(id) ON DELETE CASCADE,
 target_person_id TEXT REFERENCES people(id) ON DELETE CASCADE,
 created_by_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_calendar_org_start ON calendar_events(org_node_id,starts_at);
CREATE INDEX IF NOT EXISTS idx_calendar_person_start ON calendar_events(target_person_id,starts_at);

INSERT OR IGNORE INTO schema_version(version) VALUES(6);
PRAGMA foreign_keys = ON;
