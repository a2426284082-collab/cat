-- Route B: durable, account-scoped tasks. Apply to the SAME Cloudflare D1 bound as SALES_DB.
-- Steps have no permissions to send messages, charge payments or modify inventory.
CREATE TABLE IF NOT EXISTS sales_agent_tasks (
  id TEXT PRIMARY KEY,
  key_id INTEGER NOT NULL REFERENCES sales_keys(id),
  auth_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('waiting','thinking','paused','blocked','done')),
  revision INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  state_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sales_agent_tasks_owner ON sales_agent_tasks(key_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS sales_agent_tasks_expiry ON sales_agent_tasks(expires_at);
