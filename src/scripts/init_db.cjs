// src/scripts/init_db.cjs
/* Initialize SQLite schema from src/db/schema.sql without booting the bot */
require('dotenv/config');

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const DB_DIR  = process.env.DB_DIR ?? 'src/data';
const DB_PATH = path.join(DB_DIR, 'bot.db');
const SCHEMA  = path.join('src', 'db', 'schema.sql');

function main() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(SCHEMA)) {
    console.error(`[init_db] schema file missing at ${SCHEMA}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(SCHEMA, 'utf8');

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = wal');
  db.pragma('synchronous = NORMAL');

  console.log(`[init_db] applying schema to ${DB_PATH} …`);
  db.exec('BEGIN');
  try {
    db.exec(sql);
    db.exec('COMMIT');
    console.log('[init_db] schema ensured ✅');
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('[init_db] schema apply failed:', e);
    process.exit(1);
  }

  // (Optional) show created tables
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
  console.log('[init_db] tables:', tables.map(t => t.name).join(', '));

  db.close();
}

main();
