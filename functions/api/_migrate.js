export async function migrate(db) {
  const migrations = [
    `CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT, size INTEGER, data TEXT, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT DEFAULT 'info', title TEXT NOT NULL, message TEXT, read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS usage_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT, model TEXT, prompt_tokens INTEGER DEFAULT 0, completion_tokens INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`,
  ];
  for (const sql of migrations) {
    try { await db.prepare(sql).run(); } catch {}
  }
}
