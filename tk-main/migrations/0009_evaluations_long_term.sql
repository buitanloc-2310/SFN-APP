PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS member_evaluations(
 id TEXT PRIMARY KEY,
 person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
 org_node_id TEXT REFERENCES org_nodes(id),
 evaluator_account_id TEXT NOT NULL REFERENCES accounts(id),
 period_type TEXT NOT NULL DEFAULT 'quarter' CHECK(period_type IN ('month','quarter','half_year','year','program')),
 period_label TEXT,
 criteria_json TEXT NOT NULL DEFAULT '{}',
 total_score REAL,
 rating TEXT,
 comments TEXT,
 visibility TEXT NOT NULL DEFAULT 'member' CHECK(visibility IN ('member','admin','hidden')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','final','hidden')),
 finalized_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_member_evaluations_person ON member_evaluations(person_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_evaluations_org ON member_evaluations(org_node_id,created_at DESC);

INSERT OR IGNORE INTO permissions(id,code,name) VALUES
('perm_evaluation_manage','evaluation.manage','Quản lý đánh giá thành viên'),
('perm_evaluation_view','evaluation.view','Xem đánh giá thành viên');
INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT 'role_super_admin',id FROM permissions WHERE code IN ('evaluation.manage','evaluation.view');
INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT 'role_network_admin',id FROM permissions WHERE code IN ('evaluation.manage','evaluation.view');
INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT 'role_scope_admin',id FROM permissions WHERE code='evaluation.view';
