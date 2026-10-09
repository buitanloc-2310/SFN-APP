-- Member Digital Center V4: additive tables, no destructive updates.
CREATE TABLE IF NOT EXISTS account_restrictions (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 restriction_type TEXT NOT NULL CHECK(restriction_type IN ('ban')),
 reason TEXT NOT NULL,
 ends_at TEXT,
 actor_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_account_restriction_end ON account_restrictions(ends_at);
INSERT OR IGNORE INTO system_settings(key,value_json) VALUES
 ('member_portal_v4','{"tagline":"Mỗi thành viên là một hành trình. Mỗi đóng góp tạo nên một Sky First lớn mạnh hơn.","stats":[{"key":"members","label":"Thành viên đang hoạt động","mode":"auto","enabled":true},{"key":"activities","label":"Hoạt động đã tổ chức","mode":"auto","enabled":true},{"key":"units","label":"Đơn vị trực thuộc","mode":"auto","enabled":true},{"key":"programs","label":"Chương trình và dự án","mode":"manual","value":null,"enabled":false}]}');
