-- Cloudflare D1 初始化脚本
-- 在 D1 控制台执行，或使用：
--   npx wrangler d1 execute jimao-scores --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'campaign',
  score INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  accuracy REAL,
  secs INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS scores_score_idx ON scores (score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS scores_mode_score_idx ON scores (mode, score DESC, created_at ASC);
