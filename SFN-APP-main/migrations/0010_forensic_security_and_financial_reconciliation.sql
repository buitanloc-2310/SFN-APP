-- Migration 0010: Forensic Security, 2FA Attempt Tracking, Financial Reconciliation & Atomic SHA-256 Verified Backups
-- Additive, backward-compatible migration: preserves all existing tables, records, and issued credentials.
PRAGMA foreign_keys = ON;

-- 1. Track per-challenge 2FA OTP verification attempts
ALTER TABLE auth_tokens ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;

-- 2. Extend sponsorship_campaigns with bank recipient account & reconciliation breakdown columns
ALTER TABLE sponsorship_campaigns ADD COLUMN bank_name TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsorship_campaigns ADD COLUMN bank_bin TEXT NOT NULL DEFAULT '970422';
ALTER TABLE sponsorship_campaigns ADD COLUMN bank_account_no TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsorship_campaigns ADD COLUMN bank_account_name TEXT NOT NULL DEFAULT 'SKY FIRST NETWORK';
ALTER TABLE sponsorship_campaigns ADD COLUMN pending_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sponsorship_campaigns ADD COLUMN refunded_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sponsorship_campaigns ADD COLUMN adjusted_amount INTEGER NOT NULL DEFAULT 0;

-- 3. Extend sponsorship_transactions with forensic reconciliation & idempotency columns
ALTER TABLE sponsorship_transactions ADD COLUMN expected_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sponsorship_transactions ADD COLUMN payment_state TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE sponsorship_transactions ADD COLUMN provider_tx_id TEXT;
ALTER TABLE sponsorship_transactions ADD COLUMN reference_code TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsorship_transactions ADD COLUMN recipient_account TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsorship_transactions ADD COLUMN reconciliation_note TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsorship_transactions ADD COLUMN updated_by INTEGER;
ALTER TABLE sponsorship_transactions ADD COLUMN updated_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsorship_tx_provider_id
  ON sponsorship_transactions(provider_tx_id)
  WHERE provider_tx_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sponsorship_tx_ref
  ON sponsorship_transactions(reference_code);
CREATE INDEX IF NOT EXISTS idx_sponsorship_tx_payment_state
  ON sponsorship_transactions(campaign_id, payment_state, verification_status);

-- 4. Create sponsorship_payment_intents for VietQR / dynamic bank transfer reference tracking
CREATE TABLE IF NOT EXISTS sponsorship_payment_intents (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  reference_code TEXT NOT NULL UNIQUE,
  expected_amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'VND',
  donor_label TEXT NOT NULL DEFAULT '',
  donor_email TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  recipient_bank_bin TEXT NOT NULL DEFAULT '',
  recipient_account_no TEXT NOT NULL DEFAULT '',
  recipient_account_name TEXT NOT NULL DEFAULT '',
  qr_payload TEXT NOT NULL DEFAULT '',
  payment_state TEXT NOT NULL DEFAULT 'qr_generated',
  linked_tx_id TEXT,
  reported_at TEXT,
  webhook_received_at TEXT,
  verified_at TEXT,
  reconciled_at TEXT,
  expires_at TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(campaign_id) REFERENCES sponsorship_campaigns(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sp_intents_campaign_state
  ON sponsorship_payment_intents(campaign_id, payment_state, created_at DESC);

-- 5. Create sponsorship_audit_trail for immutable financial reconciliation history
CREATE TABLE IF NOT EXISTS sponsorship_audit_trail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT,
  transaction_id TEXT,
  action TEXT NOT NULL,
  previous_state_json TEXT NOT NULL DEFAULT '{}',
  new_state_json TEXT NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL DEFAULT '',
  actor_user_id INTEGER,
  actor_email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(campaign_id) REFERENCES sponsorship_campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY(transaction_id) REFERENCES sponsorship_transactions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sp_audit_campaign
  ON sponsorship_audit_trail(campaign_id, created_at DESC);

-- 6. Extend backups with SHA-256 integrity hash, table row counts, backup kind, and verification timestamp
ALTER TABLE backups ADD COLUMN sha256 TEXT;
ALTER TABLE backups ADD COLUMN table_counts_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE backups ADD COLUMN kind TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE backups ADD COLUMN verified_at TEXT;
CREATE INDEX IF NOT EXISTS idx_backups_created_kind ON backups(created_at DESC, kind);
