// src/db/meta.ts
import { db } from './db.js';
db.exec(`
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
const upsertStmt = db.prepare(`INSERT INTO app_meta(key, value, updated_at)
VALUES(?, ?, ?)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`);
const getStmt = db.prepare(`SELECT value FROM app_meta WHERE key=?`);
export function setMeta(key, value) {
    upsertStmt.run(key, value, new Date().toISOString());
}
export function getMeta(key) {
    const row = getStmt.get(key);
    return row?.value ?? null;
}
