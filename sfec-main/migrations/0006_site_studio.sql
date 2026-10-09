CREATE TABLE IF NOT EXISTS site_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kicker TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'inherit',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  cover_file_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER
);

CREATE TABLE IF NOT EXISTS site_page_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  kicker TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  cover_file_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER
);

CREATE INDEX IF NOT EXISTS idx_site_page_revisions_slug
ON site_page_revisions(page_slug, id DESC);

INSERT OR IGNORE INTO site_pages(slug,title,kicker,status) VALUES
('home','Trang chủ','WEBSITE CHÍNH THỨC CỦA SFEC','inherit'),
('about','Giới thiệu SFEC','GIỚI THIỆU SFEC','inherit'),
('journey','Hành trình phát triển','HÀNH TRÌNH PHÁT TRIỂN','inherit'),
('values','Định hướng & Giá trị','ĐỊNH HƯỚNG & GIÁ TRỊ','inherit'),
('organization','Cơ cấu & Hệ sinh thái','CƠ CẤU & HỆ SINH THÁI','inherit');
