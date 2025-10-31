// src/db/candidatures.ts
import { db } from './db.js';

export type CandidatureRow = {
  id: string;            // ex: message.id ou "cand_..."
  user_id: string;
  created_at: string;    // ISO
  channel_id: string;
  message_url: string | null;
  has_attachments: number; // 0/1
  status: 'open' | 'accepted' | 'rejected';
};

// ✅ PREPARED STATEMENTS (tuples typés)
const insertStmt = db.prepare<
  [string, string, string, string, string | null, number, string]
>(`INSERT INTO candidatures
    (id,user_id,created_at,channel_id,message_url,has_attachments,status)
  VALUES(?,?,?,?,?,?,?)`);

const listOpenPagedStmt = db.prepare<
  [number, number]
>(`SELECT id,user_id,created_at,channel_id,message_url,has_attachments,status
    FROM candidatures
   WHERE status='open'
ORDER BY datetime(created_at) DESC
   LIMIT ? OFFSET ?`);

const findOpenByUserStmt = db.prepare<[string]>(`
  SELECT id FROM candidatures
   WHERE user_id=? AND status='open'
   LIMIT 1
`);

const countOpenStmt = db.prepare<[]>(`SELECT COUNT(*) as c FROM candidatures WHERE status='open'`);

const setStatusStmt = db.prepare<[string, string]>(`
  UPDATE candidatures SET status=? WHERE id=?
`);

const getByIdStmt = db.prepare<[string]>(`
  SELECT id,user_id,created_at,channel_id,message_url,has_attachments,status
    FROM candidatures
   WHERE id=?`);

export function insertCandidature(row: CandidatureRow) {
  insertStmt.run(
    row.id,
    row.user_id,
    row.created_at,
    row.channel_id,
    row.message_url ?? null,
    row.has_attachments ? 1 : 0,
    row.status
  );
}

export function listOpenCandidaturesPaged(limit: number, offset: number): CandidatureRow[] {
  return listOpenPagedStmt.all(limit, offset) as CandidatureRow[];
}

export function countOpenCandidatures(): number {
  const r = countOpenStmt.get() as { c: number };
  return r?.c ?? 0;
}

export function setCandidatureStatus(id: string, status: 'accepted'|'rejected') {
  setStatusStmt.run(status, id);
}

export function getCandidatureById(id: string): CandidatureRow | null {
  return (getByIdStmt.get(id) as CandidatureRow | undefined) ?? null;
}

export function hasOpenForUser(userId: string): boolean {
  const r = findOpenByUserStmt.get(userId) as { id: string } | undefined;
  return !!r;
}
