-- CTT Sky First 2026: normalize portal identity and current URLs
PRAGMA foreign_keys = ON;
INSERT OR REPLACE INTO settings(key,value_json) VALUES('app_url','"https://ctt.skyfirst.io.vn"');
INSERT OR REPLACE INTO settings(key,value_json) VALUES('website','"https://skyfirst.io.vn"');
INSERT OR REPLACE INTO settings(key,value_json) VALUES('support_email','"hotro.sfn@gmail.com"');
INSERT OR REPLACE INTO settings(key,value_json) VALUES('hero_title','"Kết nối giáo dục. Phát triển cộng đồng."');
INSERT OR REPLACE INTO settings(key,value_json) VALUES('hero_text','"Cổng thông tin trung tâm dành cho thành viên, Core Team, học viên, hồ sơ, lớp học, hoạt động, GCN/GXN và quản trị Sky First Network."');
