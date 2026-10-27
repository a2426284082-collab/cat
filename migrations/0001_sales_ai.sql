-- Cloudflare D1. Run once through Wrangler migrations before deploying.
CREATE TABLE IF NOT EXISTS sales_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL UNIQUE,
  key_hint TEXT NOT NULL,
  sales_name TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 1 CHECK(status IN (0,1)),
  daily_limit INTEGER NOT NULL DEFAULT 20 CHECK(daily_limit BETWEEN 1 AND 1000),
  used_today INTEGER NOT NULL DEFAULT 0,
  last_call_date TEXT NOT NULL DEFAULT '',
  last_call_timestamp INTEGER NOT NULL DEFAULT 0,
  in_flight_token TEXT,
  in_flight_until INTEGER NOT NULL DEFAULT 0,
  auth_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sales_devices (
  key_id INTEGER NOT NULL REFERENCES sales_keys(id),
  device_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(key_id, device_hash)
);
CREATE TABLE IF NOT EXISTS sales_sessions (
  token_hash TEXT PRIMARY KEY,
  key_id INTEGER NOT NULL REFERENCES sales_keys(id),
  device_hash TEXT NOT NULL,
  auth_version INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sales_sessions_key ON sales_sessions(key_id);
CREATE INDEX IF NOT EXISTS sales_sessions_expiry ON sales_sessions(expires_at);
CREATE TABLE IF NOT EXISTS ai_call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  key_id INTEGER NOT NULL REFERENCES sales_keys(id),
  sales_name TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('match','script')),
  user_input TEXT NOT NULL,
  ai_output TEXT NOT NULL DEFAULT '',
  matched_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  charged INTEGER NOT NULL DEFAULT 0 CHECK(charged IN (0,1)),
  call_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ai_logs_key_recent ON ai_call_logs(key_id, id DESC);
CREATE INDEX IF NOT EXISTS ai_logs_created ON ai_call_logs(created_at);
CREATE TABLE IF NOT EXISTS ai_daily_usage (
  call_date TEXT PRIMARY KEY,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ai_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  daily_limit INTEGER NOT NULL DEFAULT 1000 CHECK(daily_limit BETWEEN 1 AND 100000)
);
INSERT OR IGNORE INTO ai_settings(id) VALUES(1);
CREATE TABLE IF NOT EXISTS sales_rate_limits (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sales_rate_expiry ON sales_rate_limits(expires_at);
