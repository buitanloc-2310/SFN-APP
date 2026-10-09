-- QR xác minh độc lập cho thẻ được thiết kế bên ngoài (Canva hoặc công cụ khác).
-- Không tạo tài khoản, hồ sơ thành viên hoặc thẻ thành viên chính thức.
CREATE TABLE IF NOT EXISTS verification_qr_records (
  id TEXT PRIMARY KEY,
  credential_title TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_label TEXT,
  organization_label TEXT,
  reference_number TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),
  verify_token TEXT NOT NULL UNIQUE,
  public_note TEXT,
  private_notes TEXT,
  created_by_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_verification_qr_status ON verification_qr_records(status);
CREATE INDEX IF NOT EXISTS idx_verification_qr_created ON verification_qr_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_qr_expiry ON verification_qr_records(expires_at);
