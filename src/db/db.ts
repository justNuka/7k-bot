import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DB_DIR = process.env.DB_DIR ?? 'src/data';
if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = join(DB_DIR, 'bot.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = wal');  // perf + safety
db.pragma('synchronous = NORMAL');
