PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS system_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS people(
 id TEXT PRIMARY KEY, member_code TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL, display_name TEXT,
 date_of_birth TEXT, gender TEXT, nationality TEXT, id_number TEXT, id_issue_date TEXT, id_issue_place TEXT,
 email TEXT, phone TEXT, permanent_address TEXT, temporary_address TEXT, avatar_url TEXT,
 joined_at TEXT, ended_at TEXT,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','ended','alumni','suspended')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_people_status ON people(status);
CREATE INDEX IF NOT EXISTS idx_people_name ON people(full_name);
CREATE INDEX IF NOT EXISTS idx_people_email ON people(email);

CREATE TABLE IF NOT EXISTS accounts(
 id TEXT PRIMARY KEY, person_id TEXT NOT NULL UNIQUE REFERENCES people(id) ON DELETE CASCADE,
 username TEXT NOT NULL UNIQUE, email TEXT UNIQUE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
 password_iterations INTEGER NOT NULL DEFAULT 100000, force_password_change INTEGER NOT NULL DEFAULT 1,
 is_locked INTEGER NOT NULL DEFAULT 0, last_login_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);

CREATE TABLE IF NOT EXISTS sessions(
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, user_agent TEXT, ip_hint TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS org_nodes(
 id TEXT PRIMARY KEY, parent_id TEXT REFERENCES org_nodes(id) ON DELETE RESTRICT,
 code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, short_name TEXT, node_type TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','archived')),
 sort_order INTEGER NOT NULL DEFAULT 0, metadata_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_org_parent ON org_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_org_type ON org_nodes(node_type);

CREATE TABLE IF NOT EXISTS org_memberships(
 id TEXT PRIMARY KEY, person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
 org_node_id TEXT NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE, title TEXT, role_label TEXT,
 started_at TEXT, ended_at TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended','suspended')),
 is_primary INTEGER NOT NULL DEFAULT 0, decision_ref TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_memberships_person ON org_memberships(person_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON org_memberships(org_node_id);

CREATE TABLE IF NOT EXISTS roles(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,description TEXT,system_role INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS permissions(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,description TEXT);
CREATE TABLE IF NOT EXISTS role_permissions(role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,PRIMARY KEY(role_id,permission_id));
CREATE TABLE IF NOT EXISTS account_scopes(
 id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,org_node_id TEXT REFERENCES org_nodes(id) ON DELETE CASCADE,
 active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_account_scopes_account ON account_scopes(account_id);
CREATE INDEX IF NOT EXISTS idx_account_scopes_org ON account_scopes(org_node_id);

CREATE TABLE IF NOT EXISTS card_types(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,description TEXT,template_json TEXT NOT NULL DEFAULT '{}',active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS member_cards(
 id TEXT PRIMARY KEY,person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,card_type_id TEXT NOT NULL REFERENCES card_types(id),
 org_node_id TEXT REFERENCES org_nodes(id),card_number TEXT NOT NULL UNIQUE,title_on_card TEXT,issued_at TEXT NOT NULL,expires_at TEXT,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),verify_token TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cards_person ON member_cards(person_id);

CREATE TABLE IF NOT EXISTS goals(
 id TEXT PRIMARY KEY,person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,org_node_id TEXT REFERENCES org_nodes(id),
 period_type TEXT NOT NULL CHECK(period_type IN ('week','month','quarter','year')),title TEXT NOT NULL,description TEXT,priority TEXT NOT NULL DEFAULT 'normal',
 progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
 starts_at TEXT,due_at TEXT,created_by_account_id TEXT REFERENCES accounts(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_goals_person ON goals(person_id);

CREATE TABLE IF NOT EXISTS tasks(
 id TEXT PRIMARY KEY,person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,org_node_id TEXT REFERENCES org_nodes(id),goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
 title TEXT NOT NULL,description TEXT,priority TEXT NOT NULL DEFAULT 'normal',progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
 status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','doing','done','cancelled')),due_at TEXT,assigned_by_account_id TEXT REFERENCES accounts(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tasks_person ON tasks(person_id);

CREATE TABLE IF NOT EXISTS activities(id TEXT PRIMARY KEY,code TEXT UNIQUE,name TEXT NOT NULL,org_node_id TEXT REFERENCES org_nodes(id),starts_at TEXT,ends_at TEXT,status TEXT NOT NULL DEFAULT 'planned',description TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS activity_participants(activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,role_label TEXT,result TEXT,verification_status TEXT NOT NULL DEFAULT 'confirmed',PRIMARY KEY(activity_id,person_id));

CREATE TABLE IF NOT EXISTS certificates(
 id TEXT PRIMARY KEY,person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,org_node_id TEXT REFERENCES org_nodes(id),certificate_no TEXT,title TEXT NOT NULL,issuer TEXT NOT NULL,issued_at TEXT,
 source_type TEXT NOT NULL CHECK(source_type IN ('internal','external')),verification_status TEXT NOT NULL DEFAULT 'verified' CHECK(verification_status IN ('provided','pending','verified','rejected')),
 file_url TEXT,verify_code TEXT UNIQUE,metadata_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_certificates_person ON certificates(person_id);

CREATE TABLE IF NOT EXISTS achievements(
 id TEXT PRIMARY KEY,person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,org_node_id TEXT REFERENCES org_nodes(id),title TEXT NOT NULL,achievement_type TEXT,issuer TEXT,achieved_at TEXT,
 verification_status TEXT NOT NULL DEFAULT 'verified',source_type TEXT NOT NULL DEFAULT 'internal',description TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_achievements_person ON achievements(person_id);

CREATE TABLE IF NOT EXISTS member_documents(id TEXT PRIMARY KEY,person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,org_node_id TEXT REFERENCES org_nodes(id),document_type TEXT NOT NULL,title TEXT NOT NULL,file_url TEXT,issued_at TEXT,visibility TEXT NOT NULL DEFAULT 'private',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_member_documents_person ON member_documents(person_id);

CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,person_id TEXT REFERENCES people(id) ON DELETE CASCADE,org_node_id TEXT REFERENCES org_nodes(id),type TEXT NOT NULL DEFAULT 'system',title TEXT NOT NULL,body TEXT,read_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_notifications_person ON notifications(person_id,read_at);

CREATE TABLE IF NOT EXISTS support_tickets(id TEXT PRIMARY KEY,ticket_code TEXT NOT NULL UNIQUE,person_id TEXT REFERENCES people(id),category TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','in_progress','responded','completed')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS cv_exports(id TEXT PRIMARY KEY,person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,export_code TEXT NOT NULL UNIQUE,selected_fields_json TEXT NOT NULL,file_url TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_account_id TEXT REFERENCES accounts(id),action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT,org_node_id TEXT REFERENCES org_nodes(id),details_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_account_id);

INSERT OR IGNORE INTO schema_version(version) VALUES(1);
INSERT OR IGNORE INTO org_nodes(id,parent_id,code,name,short_name,node_type,sort_order) VALUES
('org_sfn',NULL,'SFN','Mạng lưới Giáo dục & Phát triển Cộng đồng Sky First','SFN','network',0),
('org_bch','org_sfn','SFN-BCH','Ban Chấp hành Mạng lưới','BCH','executive_board',10),
('org_office','org_sfn','SFN-VP','Văn phòng Mạng lưới','Văn phòng','office',20);

INSERT OR IGNORE INTO permissions(id,code,name) VALUES
('perm_member_view','member.view','Xem hồ sơ thành viên'),('perm_member_edit','member.edit','Chỉnh sửa hồ sơ thành viên'),
('perm_org_manage','org.manage','Quản lý cơ cấu tổ chức'),('perm_account_manage','account.manage','Quản lý tài khoản'),
('perm_role_manage','role.manage','Quản lý phân quyền'),('perm_goal_manage','goal.manage','Quản lý mục tiêu'),
('perm_task_manage','task.manage','Quản lý công việc'),('perm_activity_manage','activity.manage','Quản lý hoạt động'),
('perm_certificate_manage','certificate.manage','Quản lý chứng nhận'),('perm_achievement_manage','achievement.manage','Quản lý thành tích'),
('perm_card_manage','card.manage','Quản lý thẻ'),('perm_audit_view','audit.view','Xem nhật ký hệ thống'),
('perm_system_manage','system.manage','Quản lý hệ thống');

INSERT OR IGNORE INTO roles(id,code,name,description,system_role) VALUES
('role_member','MEMBER','Thành viên','Quyền sử dụng Cổng Thành viên',1),
('role_scope_admin','SCOPE_ADMIN','Quản trị phạm vi','Quản trị trong node được cấp',1),
('role_network_admin','NETWORK_ADMIN','Quản trị Mạng lưới','Quản trị cấp Mạng lưới',1),
('role_super_admin','SUPER_ADMIN','Quản trị hệ thống','Quyền cao nhất hệ thống',1);
INSERT OR IGNORE INTO role_permissions(role_id,permission_id) SELECT 'role_super_admin',id FROM permissions;

INSERT OR IGNORE INTO card_types(id,code,name,description) VALUES
('card_member','MEMBER','Thẻ Thành viên SFN','Thẻ nhận diện thành viên Mạng lưới'),
('card_executive','EXECUTIVE','Thẻ Ban Chấp hành','Thẻ dành cho thành viên Ban Chấp hành'),
('card_unit','UNIT','Thẻ Đơn vị trực thuộc','Thẻ theo đơn vị trực thuộc'),
('card_volunteer','VOLUNTEER','Thẻ Tình nguyện viên','Thẻ theo chương trình/dự án tình nguyện'),
('card_advisor','ADVISOR','Thẻ Cố vấn','Thẻ dành cho cố vấn'),
('card_alumni','ALUMNI','Thẻ Cựu thành viên','Thẻ ghi nhận cựu thành viên');

INSERT OR IGNORE INTO system_settings(key,value_json) VALUES
('organization','{"name":"Mạng lưới Giáo dục & Phát triển Cộng đồng Sky First","short_name":"SFN"}'),
('member_code','{"prefix":"SFN","width":6}'),
('security','{"session_days":7,"require_password_change_on_first_login":true}'),
('setup','{"completed":false}');
