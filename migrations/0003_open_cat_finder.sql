-- Run once for the open cat-finder plan. Existing custom administrator settings are preserved.
-- Fresh installs start at 500/day; existing untouched 1000/day settings become 500.
UPDATE ai_settings SET daily_limit=500 WHERE id=1 AND daily_limit=1000;
-- Upgrade the untouched old 20/day sales tier to 50/day. Custom limits are preserved.
UPDATE sales_keys SET daily_limit=50 WHERE key_hint != 'PUBLIC_GUEST_V1' AND daily_limit=20;
-- Keep already-saved workbench defaults in sync when still at factory 20.
CREATE TABLE IF NOT EXISTS workbench_config (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL, updated_at INTEGER NOT NULL);
UPDATE workbench_config SET value=json_set(value,'$.defaultDailyLimit',50)
 WHERE id=1 AND json_valid(value) AND json_extract(value,'$.defaultDailyLimit')=20;
