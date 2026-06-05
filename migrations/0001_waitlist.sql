-- D1 (SQLite) schema for the early-access waitlist.
-- Apply: npx wrangler d1 execute fcharts-waitlist --file=./migrations/0001_waitlist.sql
CREATE TABLE IF NOT EXISTS waitlist (
  email      TEXT PRIMARY KEY,                         -- lowercased; PK makes resubmits idempotent
  created_at TEXT NOT NULL DEFAULT (datetime('now')),  -- UTC ISO-ish timestamp
  source     TEXT,                                     -- which form: 'cta' | 'hero' | …
  user_agent TEXT
);
