// src/db/init.ts
// Initializes the database by running the schema SQL file.

import { readFileSync } from 'fs';
import { db } from './db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('DB');

export function runMigrations() {
  const sql = readFileSync('src/db/schema.sql', 'utf8');
  db.exec(sql);
  
  // Vérifier que WAL est bien actif
  const journalMode = db.pragma('journal_mode', { simple: true });
  log.info('Schéma DB appliqué');
  log.info({ journalMode }, journalMode === 'wal' ? 'WAL mode actif ✓' : '⚠️ WAL mode inactif');
}
