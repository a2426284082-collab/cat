-- Additive migration. Reuse existing sales_keys identities; do not recreate AI tables.
CREATE TABLE IF NOT EXISTS sales_agent_profiles (
  owner_id INTEGER PRIMARY KEY REFERENCES sales_keys(id),
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  wechat TEXT NOT NULL DEFAULT '',
  default_markup REAL NOT NULL DEFAULT 800,
  qr_id TEXT,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sales_proposal_qr (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES sales_keys(id),
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sales_proposal_qr_owner ON sales_proposal_qr(owner_id);
CREATE TABLE IF NOT EXISTS sales_proposals (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES sales_keys(id),
  customer_name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  profile_json TEXT NOT NULL,
  cats_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  request_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  UNIQUE(owner_id,request_key)
);
CREATE INDEX IF NOT EXISTS sales_proposals_owner_created ON sales_proposals(owner_id,created_at DESC);
CREATE INDEX IF NOT EXISTS sales_proposals_expiry ON sales_proposals(expires_at);
