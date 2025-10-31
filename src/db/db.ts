import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

// Support pour AlwaysData : SQLITE_PATH=/home/<USER>/data/bot.db
// Sinon fallback sur DB_DIR (dev local)
let DB_PATH: string;

if (process.env.SQLITE_PATH) {
  DB_PATH = process.env.SQLITE_PATH;
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
} else {
  const DB_DIR = process.env.DB_DIR ?? 'src/data';
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
  DB_PATH = join(DB_DIR, 'bot.db');
}

export const db = new Database(DB_PATH);

// WAL mode pour accès concurrents (bot daemon + dashboard web app)
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
// Timeout 5s pour les locks (au lieu de fail immédiat)
db.pragma('busy_timeout = 5000');
