// src/db/absences.ts
import { db } from './db.js';

export type AbsenceRow = {
  id: string;
  user_id: string;
  start_iso: string;
  end_iso: string;
  reason: string | null;
  note: string | null;
  created_at: string;
};

/** Génère un id "abs_YYYYMMDD_HHmmss_xxxx" */
export function newAbsId(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date();
  const stamp =
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '_' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds());
  const rnd = Math.random().toString(36).slice(2, 6);
  return `abs_${stamp}_${rnd}`;
}

export function insertAbsence(a: {
  id?: string;
  userId: string;
  startIso: string;
  endIso: string;
  reason?: string | null;
  note?: string | null;
  createdAt?: string; // default now
}): AbsenceRow {
  const id = a.id ?? newAbsId();
  const created = a.createdAt ?? new Date().toISOString();

  db.prepare(
    `INSERT INTO absences (id, user_id, start_iso, end_iso, reason, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, a.userId, a.startIso, a.endIso, a.reason ?? null, a.note ?? null, created);

  // better-sqlite3 typings varient; on caste le résultat
  const row = db.prepare(`SELECT * FROM absences WHERE id = ?`).get(id) as AbsenceRow | undefined;
  if (!row) {
    return {
      id,
      user_id: a.userId,
      start_iso: a.startIso,
      end_iso: a.endIso,
      reason: a.reason ?? null,
      note: a.note ?? null,
      created_at: created,
    };
  }
  return row;
}

/** Absences en cours / futures : end_iso >= today */
export function listActiveAbsences(): AbsenceRow[] {
  const rows = db.prepare(
    `SELECT * FROM absences
     WHERE date(end_iso) >= date('now')
     ORDER BY date(start_iso) ASC, created_at ASC`
  ).all() as AbsenceRow[];
  return rows;
}

/** Vue complète */
export function listAllAbsences(): AbsenceRow[] {
  const rows = db.prepare(
    `SELECT * FROM absences
     ORDER BY date(start_iso) ASC, created_at ASC`
  ).all() as AbsenceRow[];
  return rows;
}
