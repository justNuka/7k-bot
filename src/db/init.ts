// src/db/init.ts
// Initializes the database by running the schema SQL file.

import { readFileSync } from 'fs';
import { db } from './db.js';

export function runMigrations() {
  const sql = readFileSync('src/db/schema.sql', 'utf8');
  db.exec(sql);
  
  // Vérifier que WAL est bien actif
  const journalMode = db.pragma('journal_mode', { simple: true });
  console.log('[DB] schema ensured');
  console.log(`[DB] journal_mode = ${journalMode} ${journalMode === 'wal' ? '✓' : '⚠️ WAL not active!'}`);
}