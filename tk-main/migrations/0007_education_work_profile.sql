-- Add education/workplace profile fields without changing existing data.
ALTER TABLE people ADD COLUMN education_or_work_type TEXT;
ALTER TABLE people ADD COLUMN school_or_workplace TEXT;
ALTER TABLE people ADD COLUMN class_or_major TEXT;
ALTER TABLE people ADD COLUMN education_status TEXT;
INSERT OR IGNORE INTO schema_version(version) VALUES(7);
