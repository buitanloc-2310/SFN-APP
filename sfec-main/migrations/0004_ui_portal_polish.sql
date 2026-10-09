PRAGMA foreign_keys = ON;

-- Đồng bộ cấu hình công khai của Cổng SFEC hiện hành.
UPDATE settings SET value_json='"https://ctt.sfec.skyfirst.io.vn"', updated_at=CURRENT_TIMESTAMP WHERE key='app_url';
UPDATE settings SET value_json='"https://www.skyfirst.io.vn"', updated_at=CURRENT_TIMESTAMP WHERE key='website';
UPDATE settings SET value_json='"Học tiếng Anh. Kết nối cộng đồng. Phát triển cùng nhau."', updated_at=CURRENT_TIMESTAMP WHERE key='hero_title';
UPDATE settings SET value_json='"Cổng thông tin chính thức của Câu lạc bộ Tiếng Anh The Sky First (SFEC), cung cấp thông tin lớp học, hoạt động, chương trình, cơ hội tham gia và các nội dung dành cho học viên, thành viên và cộng đồng."', updated_at=CURRENT_TIMESTAMP WHERE key='hero_text';

INSERT OR REPLACE INTO meta(key,value) VALUES('sfec_ui_portal_polish_version','1');
